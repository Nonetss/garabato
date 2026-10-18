#!/usr/bin/env bash
# Tests install.ps1 and uninstall.ps1 end to end against the stub Garabato
# (tests/install/stub-server.ts), with PowerShell in a container and a
# throwaway APPDATA/LOCALAPPDATA holding real NSS profiles. The container
# runs PowerShell 7 on Linux; NSS's modutil on this machine then checks that
# every edited pkcs11.txt still parses. Windows PowerShell 5.1 itself is only
# checked on a real Windows computer.
#
# Needs bun, docker and the NSS tools. Usage: tests/install-windows/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

image="${PWSH_IMAGE:-mcr.microsoft.com/powershell:latest}"
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

# Any bytes do for the module: Windows never loads it here.
printf 'fake windows module\n' >"$work/fake.dll"
MODULE_PATH="$work/fake.dll" bun tests/install/stub-server.ts >"$work/port" &
server_pid=$!
for _ in $(seq 50); do
  [ -s "$work/port" ] && break
  sleep 0.1
done
url="http://127.0.0.1:$(cat "$work/port")"
script_url="$url/api/v1/certificateToken/installScript?code=7KQ4XMPA&os=windows"

appdata="$work/appdata"
localappdata="$work/localappdata"
firefox="$appdata/Mozilla/Firefox/Profiles/abcd1234.default-release"
zen="$appdata/zen/Profiles/52tw3itb.Default (release)"
elsewhere="$work/elsewhere/zen-work"
unopened="$appdata/Mozilla/Firefox/Profiles/zzzz9999.never-opened"
for db in "$firefox" "$zen" "$elsewhere"; do
  mkdir -p "$db"
  certutil -N -d "sql:$db" --empty-password
done
mkdir -p "$unopened"
touch "$unopened/cert9.db"
# Zen's file with Windows line endings and an older Garabato entry.
printf '\nlibrary=C:\\old\\garabato_pkcs11.dll\nname=Garabato\n' >>"$zen/pkcs11.txt"
sed -i 's/$/\r/' "$zen/pkcs11.txt"
printf '[Profile0]\r\nName=Default (release)\r\nIsRelative=1\r\nPath=Profiles/52tw3itb.Default (release)\r\n\r\n[Profile1]\r\nName=Work\r\nIsRelative=0\r\nPath=%s\r\n' \
  "$elsewhere" >"$appdata/zen/profiles.ini"

pwsh() {
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -e HOME="$work" -e APPDATA="$appdata" -e LOCALAPPDATA="$localappdata" \
    -e PROCESSOR_ARCHITECTURE=AMD64 -v "$work:$work" "$image" \
    pwsh -NoProfile -NonInteractive "$@"
}

module="$localappdata/Garabato/garabato_pkcs11.dll"
entries() { grep -c "^name=Garabato" "$1/pkcs11.txt"; }
points_at_module() { grep -qxF "library=$module" <(tr -d '\r' <"$1/pkcs11.txt"); }
keeps_internal() { grep -q "^name=NSS Internal PKCS #11 Module" "$1/pkcs11.txt"; }
nss_lists() { modutil -dbdir "sql:$1" -list 2>/dev/null | grep -q "$2"; }
no_bom() { [ "$(head -c 3 "$1" | od -An -tx1 | tr -d ' ')" != "efbbbf" ]; }

echo "== install"
pwsh -Command "irm '$script_url' | iex" >"$work/install.log" 2>&1 || true
for profile in "$firefox" "$zen" "$elsewhere"; do
  label="$(basename "$profile")"
  check "$label: exactly one Garabato entry" test "$(entries "$profile")" -eq 1
  check "$label: points at the installed module" points_at_module "$profile"
  check "$label: keeps NSS's internal module" keeps_internal "$profile"
  check "$label: NSS still parses it" nss_lists "$profile" "NSS Internal PKCS #11 Module"
  check "$label: no byte-order mark" no_bom "$profile/pkcs11.txt"
done
check "keeps Windows line endings" grep -q $'\r$' "$zen/pkcs11.txt"
check "skips a profile never opened" test ! -e "$unopened/pkcs11.txt"
check "says which profile was never opened" grep -q "never-opened: ábrelo una vez" "$work/install.log"
check "installs the module" cmp -s "$work/fake.dll" "$module"
config="$appdata/Garabato/token.json"
check "writes the configuration" grep -q '"key": *"gbt_test_secret_key"' "$config"
check "configuration has no byte-order mark" no_bom "$config"
check "never prints the key" sh -c "! grep -q gbt_test_secret_key '$work/install.log'"
check "names the Zen profile" grep -q "Zen, perfil Default (release)" "$work/install.log"
check "says it is ready" grep -q "Listo" "$work/install.log"
check "leaves an uninstall script with a byte-order mark" \
  test "$(head -c 3 "$localappdata/Garabato/uninstall.ps1" | od -An -tx1 | tr -d ' ')" = "efbbbf"

echo "== the same command again"
cp "$firefox/pkcs11.txt" "$work/before.txt"
pwsh -Command "irm '$script_url' | iex" >"$work/again.log" 2>&1 || true
check "says it expired" grep -q "caducado" "$work/again.log"
check "changes nothing" cmp -s "$work/before.txt" "$firefox/pkcs11.txt"

echo "== uninstall"
pwsh -File "$localappdata/Garabato/uninstall.ps1" >"$work/uninstall.log" 2>&1 || true
for profile in "$firefox" "$zen" "$elsewhere"; do
  label="$(basename "$profile")"
  check "$label: Garabato removed" test "$(entries "$profile")" -eq 0
  check "$label: internal module kept" keeps_internal "$profile"
done
check "removes the module and the configuration" sh -c "test ! -e '$module' && test ! -e '$config'"

# SHOW_LOG=1 prints what the user would see.
if [ "$failures" -gt 0 ] || [ -n "${SHOW_LOG:-}" ]; then
  echo
  echo "Install log:"
  cat "$work/install.log"
  echo "Uninstall log:"
  cat "$work/uninstall.log"
fi
[ "$failures" -eq 0 ] || exit 1
echo
echo "All Windows install checks passed."
