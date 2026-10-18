#!/usr/bin/env bash
# End-to-end check against a real Garabato, without a browser: NSS (the
# library Firefox and Chromium use on Linux) loads the module from a
# throwaway database, asks for the token's PIN (your TOTP code) and signs a
# TLS handshake against a local openssl s_server that asks for a client
# certificate. Uses your module configuration, so run it after "Conectar
# navegador". Needs cargo, cc, openssl and the NSS headers.
#
# Usage: tests/e2e/run.sh [connections, default 3]
set -euo pipefail
cd "$(dirname "$0")/../.."

config="${XDG_CONFIG_HOME:-$HOME/.config}/garabato/token.json"
if [ ! -f "$config" ]; then
  cat >&2 <<EOF
No encuentro la configuración del módulo en $config.
Créala desde Garabato: Certificados → Conectar navegador, guárdala en ese
archivo y ejecuta  chmod 600 "$config"
EOF
  exit 1
fi

connections="${1:-3}"
work="$(mktemp -d)"
server_pid=""
cleanup() {
  if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

cargo build --release --quiet
cc -O2 -o "$work/nssclient" tests/e2e/nssclient.c $(pkg-config --cflags --libs nss)

mkdir "$work/nssdb"
certutil -N -d "sql:$work/nssdb" --empty-password
modutil -dbdir "sql:$work/nssdb" -force -add "Garabato" \
  -libfile "$PWD/target/release/libgarabato_pkcs11.so" >/dev/null

# Self-signed server certificate; the client does not check it.
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=localhost" \
  -keyout "$work/server.key" -out "$work/server.pem" 2>/dev/null
port=$((20000 + RANDOM % 20000))
# -verify asks for a client certificate and accepts any, so a real one
# issued by FNMT or another authority works without trusting it here.
openssl s_server -accept "$port" -www -cert "$work/server.pem" \
  -key "$work/server.key" -verify 1 >"$work/server.log" 2>&1 &
server_pid=$!
sleep 0.5

read -rp "Código de tu app de verificación en dos pasos: " code
"$work/nssclient" "sql:$work/nssdb" localhost "$port" - "$code" "$connections"

echo
echo "Últimas líneas del log del módulo:"
tail -n 8 "${XDG_STATE_HOME:-$HOME/.local/state}/garabato/pkcs11.log"
