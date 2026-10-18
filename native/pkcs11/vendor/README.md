# Vendored crates

`native-pkcs11/` is `native-pkcs11` 0.2.27 from crates.io (Apache-2.0, see
its `LICENSE`) with one change in its `Cargo.toml`: `crate-type = ["lib"]`
instead of `["lib", "cdylib"]`. Upstream's standalone DLL cannot link on
Windows when `custom-function-list` moves `C_GetFunctionList` into the
crate that uses it (`garabato-pkcs11`). Linux is unaffected: undefined
symbols are allowed in shared objects there.

To update: copy the new release from the cargo registry over this folder,
reapply the change and bump the version pin in `../Cargo.toml`.
