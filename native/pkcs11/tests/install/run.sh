#!/usr/bin/env bash
# Tests the install and uninstall scripts end to end against a stub Garabato
# (stub-server.ts), in a throwaway HOME with a Firefox profile, real NSS
# databases and the real module. Nothing outside the temp folder is touched,
# and a browser running on this machine does not block the test (pgrep is
# faked). Needs bun, cargo, curl and the NSS tools.
#
# Usage: tests/install/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

work="$(mktemp -d)"
server_pid=""
cleanup() {
  if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

failures=0
check() {
  local name="$1"
  shift
  if "$@"; then
    echo "ok   $name"
  else
    echo "FAIL $name"
    failures=$((failures + 1))
  fi
}

cargo build --release --quiet
module="$PWD/target/release/libgarabato_pkcs11.so"

# A PATH with only what the scripts may use, so a missing tool can be faked.
tools="$work/bin"
mkdir -p "$tools"
for tool in sh curl sha256sum sed cut sort mktemp mkdir chmod mv rm cat id uname basename sleep rmdir modutil certutil; do
  ln -s "$(command -v "$tool")" "$tools/$tool"
done
printf '#!/bin/sh\nexit 1\n' >"$tools/pgrep"
chmod +x "$tools/pgrep"
no_nss="$work/bin-no-nss"
cp -a "$tools" "$no_nss"
rm "$no_nss/modutil" "$no_nss/certutil"

MODULE_PATH="$module" bun tests/install/stub-server.ts >"$work/port" &
server_pid=$!
for _ in $(seq 50); do
  [ -s "$work/port" ] && break
  sleep 0.1
done
url="http://127.0.0.1:$(cat "$work/port")"
script_url="$url/api/v1/certificateToken/installScript?code=7KQ4XMPA"
redeems() { curl -fsS "$url/stats" | sed -n 's/.*"redeems":\([0-9]*\).*/\1/p'; }

home="$work/home"
profile="$home/.mozilla/firefox/abcd1234.default-release"
# Zen, a Firefox derivative, with a space in the profile name as it creates
# them, plus a profile profiles.ini keeps outside its root.
zen="$home/.config/zen/52tw3itb.Default (release)"
elsewhere="$work/profiles/zen-elsewhere"
mkdir -p "$profile" "$zen" "$elsewhere" "$home/.pki/nssdb"
for db in "$profile" "$zen" "$elsewhere"; do
  certutil -N -d "sql:$db" --empty-password
done
printf '[Profile0]\nName=Default (release)\nIsRelative=1\nPath=52tw3itb.Default (release)\n\n[Profile1]\nName=Work\nIsRelative=0\nPath=%s\n' \
  "$elsewhere" >"$home/.config/zen/profiles.ini"
run_as_user() {
  local path="$1"
  shift
  env -i HOME="$home" PATH="$path" "$@"
}
has_module() { modutil -dbdir "sql:$1" -list 2>/dev/null | grep -q "Garabato"; }

echo "== without modutil"
set +e
run_as_user "$no_nss" sh -c "curl -fsSL '$script_url' | sh" >"$work/no-nss.log" 2>&1
status=$?
set -e
check "stops with an error" test "$status" -ne 0
check "names the NSS package" grep -q "libnss3-tools" "$work/no-nss.log"
check "does not spend the code" test "$(redeems)" -eq 0

echo "== install"
run_as_user "$tools" sh -c "curl -fsSL '$script_url' | sh" >"$work/install.log" 2>&1
config="$home/.config/garabato/token.json"
check "writes the configuration" grep -q '"key": "gbt_test_secret_key"' "$config"
check "configuration is owner-only" test "$(stat -c %a "$config")" = 600
check "installs the module" cmp -s "$module" "$home/.local/share/garabato/libgarabato_pkcs11.so"
check "registers in the Firefox profile" has_module "$profile"
check "registers in Chromium's database" has_module "$home/.pki/nssdb"
check "registers in the Zen profile" has_module "$zen"
check "registers in a profile kept elsewhere" has_module "$elsewhere"
check "names the Zen profile as the user knows it" grep -q "Zen, perfil Default (release)" "$work/install.log"
check "never prints the key" sh -c "! grep -q gbt_test_secret_key '$work/install.log'"
check "says it is ready" grep -q "Listo" "$work/install.log"

echo "== the same command again"
set +e
run_as_user "$tools" sh -c "curl -fsSL '$script_url' | sh" >"$work/again.log" 2>&1
status=$?
set -e
check "refuses a spent code" test "$status" -ne 0
check "says it expired" grep -q "caducado" "$work/again.log"

echo "== uninstall"
run_as_user "$tools" sh "$home/.local/share/garabato/uninstall.sh" >"$work/uninstall.log" 2>&1
check "unregisters from Firefox" sh -c "! modutil -dbdir 'sql:$profile' -list 2>/dev/null | grep -q Garabato"
check "unregisters from Chromium" sh -c "! modutil -dbdir 'sql:$home/.pki/nssdb' -list 2>/dev/null | grep -q Garabato"
check "unregisters from Zen" sh -c "! modutil -dbdir 'sql:$zen' -list 2>/dev/null | grep -q Garabato"
check "unregisters from the profile kept elsewhere" sh -c "! modutil -dbdir 'sql:$elsewhere' -list 2>/dev/null | grep -q Garabato"
check "removes the module and the configuration" sh -c "test ! -e '$config' && test ! -e '$home/.local/share/garabato'"

# SHOW_LOG=1 prints what the user would see.
if [ "$failures" -gt 0 ] || [ -n "${SHOW_LOG:-}" ]; then
  echo
  echo "Install log:"
  cat "$work/install.log"
fi
[ "$failures" -eq 0 ] || exit 1
echo
echo "All install checks passed."
