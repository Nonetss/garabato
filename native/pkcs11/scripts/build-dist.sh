#!/usr/bin/env bash
# Builds the module for this machine's architecture into dist/<arch>/, where
# the backend serves it to the install script (native dev; the production
# image builds both architectures itself).
#
# Usage: scripts/build-dist.sh
set -euo pipefail
cd "$(dirname "$0")/.."

case "$(uname -m)" in
  x86_64 | amd64) arch=x86_64 ;;
  aarch64 | arm64) arch=aarch64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

cargo build --release --quiet
mkdir -p "dist/$arch"
cp target/release/libgarabato_pkcs11.so "dist/$arch/libgarabato_pkcs11.so"
echo "dist/$arch/libgarabato_pkcs11.so"
