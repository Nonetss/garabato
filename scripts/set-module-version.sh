#!/usr/bin/env bash
# Sets the browser token module's version to a release's, so the binary the
# installers hand out carries the same version as the GitHub release:
# native/pkcs11/Cargo.toml, its Cargo.lock and MODULE_VERSION in
# packages/api/src/shared/token-module.ts (a unit test keeps the last two
# equal). The /tag command runs it before tagging.
#
# Usage: scripts/set-module-version.sh <version>   (0.4.0 or v0.4.0)
set -euo pipefail
cd "$(dirname "$0")/.."

version="${1:-}"
version="${version#v}"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: $0 <major.minor.patch>  (e.g. 0.4.0 or v0.4.0)" >&2
  exit 1
fi

manifest=native/pkcs11/Cargo.toml
constant=packages/api/src/shared/token-module.ts

# The package version is the first `version =` line of the manifest.
sed -i "0,/^version = \"[^\"]*\"$/s//version = \"$version\"/" "$manifest"
sed -i "s/^export const MODULE_VERSION = \"[^\"]*\"$/export const MODULE_VERSION = \"$version\"/" "$constant"
# The crate's own entry in the lockfile: the `version` line right after its
# `name`. Edited directly, since cargo would want the network to resolve
# every platform's dependencies.
lockfile=native/pkcs11/Cargo.lock
awk -v version="$version" '
  found && /^version = / { print "version = \"" version "\""; found = 0; next }
  { print }
  $0 == "name = \"garabato-pkcs11\"" { found = 1 }
' "$lockfile" >"$lockfile.tmp" && mv "$lockfile.tmp" "$lockfile"

grep -q "^version = \"$version\"$" "$manifest" || { echo "Could not set $manifest" >&2; exit 1; }
grep -q "^export const MODULE_VERSION = \"$version\"$" "$constant" || { echo "Could not set $constant" >&2; exit 1; }
grep -A1 '^name = "garabato-pkcs11"$' "$lockfile" | grep -q "^version = \"$version\"$" || { echo "Could not set $lockfile" >&2; exit 1; }
echo "Module version set to $version"
