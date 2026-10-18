#!/usr/bin/env bash
# Builds the module into dist/, where a natively run backend and the Docker
# dev stack serve it to the install scripts (the production image builds
# every platform itself).
#
# Usage: scripts/build-dist.sh [linux|windows|all]   (default: linux)
#   linux    this machine's architecture, with the local cargo
#   windows  x86_64 Windows, with the backend Dockerfile's module stage
#            (needs Docker; no Windows toolchain on this machine)
set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-linux}"

build_linux() {
  local arch
  case "$(uname -m)" in
    x86_64 | amd64) arch=x86_64 ;;
    aarch64 | arm64) arch=aarch64 ;;
    *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
  esac
  cargo build --release --quiet
  mkdir -p "dist/$arch"
  cp target/release/libgarabato_pkcs11.so "dist/$arch/libgarabato_pkcs11.so"
  echo "dist/$arch/libgarabato_pkcs11.so"
}

build_windows() {
  local image=garabato-module-build container
  docker build --quiet --target module -t "$image" -f ../../apps/backend/Dockerfile ../.. >/dev/null
  container="$(docker create "$image")"
  mkdir -p dist
  docker cp "$container:/dist/windows-x86_64" dist/ >/dev/null
  docker rm "$container" >/dev/null
  docker image rm "$image" >/dev/null
  echo "dist/windows-x86_64/garabato_pkcs11.dll"
}

case "$target" in
  linux) build_linux ;;
  windows) build_windows ;;
  all) build_linux && build_windows ;;
  *) echo "Usage: $0 [linux|windows|all]" >&2; exit 1 ;;
esac
