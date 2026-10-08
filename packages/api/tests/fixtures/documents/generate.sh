#!/usr/bin/env bash
# Regenerates the PDF fixtures used by the document tests. Requires bun and
# qpdf. Usage: bash packages/api/tests/fixtures/documents/generate.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bun "$DIR/build.ts" "$DIR"
qpdf --encrypt user-secret owner-secret 256 -- "$DIR/plain.pdf" "$DIR/encrypted.pdf"
printf 'this is not a PDF file\n' > "$DIR/not-a-pdf.pdf"

echo "Fixtures written to $DIR"
