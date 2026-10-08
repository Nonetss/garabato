#!/usr/bin/env bash
# Regenerates the PKCS#12 fixtures used by the certificate tests. Everything
# here is throwaway test material signed by a throwaway CA: never put a real
# certificate in this folder. Every file uses the password "1234".
#
# Usage: bash packages/api/tests/fixtures/certificates/generate.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

PASS="pass:1234"
SUBJECT="/C=ES/serialNumber=IDCES-12345678Z/GN=JUAN/SN=ESPAÑOL PÉREZ/CN=ESPAÑOL PÉREZ JUAN - 12345678Z"

cat > signing.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,nonRepudiation
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid
EOF
cat > encipherment.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=critical,keyEncipherment
EOF

openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt \
  -days 3650 -subj "/C=ES/O=AUTOFIRMAS PRUEBAS/CN=AC PRUEBAS AUTOFIRMAS" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null

# issue <name> <subject> <key algorithm args...> -- <extfile>
issue() {
  local name="$1" subject="$2" ext="$3"
  shift 3
  openssl req -new "$@" -nodes -keyout "$name.key" -out "$name.csr" -utf8 \
    -subj "$subject" 2>/dev/null
  openssl x509 -req -in "$name.csr" -CA ca.crt -CAkey ca.key \
    -CAcreateserial -out "$name.crt" -days 3650 -extfile "$ext" 2>/dev/null
}

issue rsa "$SUBJECT" signing.ext -newkey rsa:2048
issue ec "$SUBJECT" signing.ext -newkey ec -pkeyopt ec_paramgen_curve:P-256
issue other "$SUBJECT" signing.ext -newkey rsa:2048
issue no-tax-id "/C=ES/CN=PRUEBA SIN NIF" signing.ext -newkey rsa:2048
issue encipherment "$SUBJECT" encipherment.ext -newkey rsa:2048

export_p12() {
  local out="$1"
  shift
  openssl pkcs12 -export "$@" -certfile ca.crt -passout "$PASS" \
    -out "$DIR/$out"
}

export_p12 rsa.p12 -inkey rsa.key -in rsa.crt -name "Juan RSA"
export_p12 rsa-legacy.p12 -legacy -inkey rsa.key -in rsa.crt -name "Juan RSA"
export_p12 ec.p12 -inkey ec.key -in ec.crt -name "Juan EC"
export_p12 no-tax-id.p12 -inkey no-tax-id.key -in no-tax-id.crt
export_p12 encipherment.p12 -inkey encipherment.key -in encipherment.crt
export_p12 no-key.p12 -nokeys -in rsa.crt

# OpenSSL refuses to build these two; forge does (see build-invalid.ts).
bun "$DIR/build-invalid.ts" "$WORK" "$DIR"

printf 'this is not a PKCS#12 file\n' > "$DIR/not-a-p12.p12"

echo "Fixtures written to $DIR"
