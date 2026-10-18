## 1. Module for Windows

- [x] 1.1 Spike in Docker: cross-compile `native/pkcs11` for `x86_64-pc-windows-gnu` with MinGW and `+crt-static`; verify it builds (or apply the fallback for `native-pkcs11-windows`) and that `x86_64-w64-mingw32-objdump -p` lists only system DLLs and exports `C_GetFunctionList` — needed a vendored `native-pkcs11` without `cdylib` (`native/pkcs11/vendor/`); the DLL imports only system DLLs and exports `C_GetFunctionList`
- [x] 1.2 Per-OS configuration and log directories in `src/config.rs`/`src/log.rs` (pure resolution from an `Os` and an environment lookup; owner-only check `#[cfg(unix)]`); verify `cargo test` covers both OS branches and `cargo clippy --all-targets` is clean

## 2. Backend

- [x] 2.1 `token-module.ts`: `(os, arch)` → module path (`dist/windows-x86_64/garabato_pkcs11.dll`), Windows script rendering and expired PowerShell script; verify unit tests (Windows file present/missing, `windows`+`aarch64` refused, both templates render without placeholders left)
- [x] 2.2 `certificate-token`: `startConnection` answers `commands: { linux, windows }`; `redeem`, `module` and `installScript` take `os` (default `linux`); verify handler tests for both OS and that the Linux paths behave as before
- [x] 2.3 Run `bun run check-types`, Biome and `bun run test`; verify all pass

## 3. PowerShell scripts

- [x] 3.1 Write `native/pkcs11/install/install.ps1` and `uninstall.ps1` per design.md (PowerShell 5.1 syntax, UTF-8 without BOM, line endings kept)
- [x] 3.2 Add `native/pkcs11/tests/install-windows/run.sh` (pwsh container, stub server with Windows endpoints, throwaway APPDATA with real NSS profiles incl. CRLF and `profiles.ini` elsewhere); verify install registers exactly one "Garabato" entry per profile, keeps the other entries, `modutil -list` still parses each file, no BOM, the key is never printed, a spent code changes nothing, a re-run replaces the entry, and uninstall removes it — it caught a renderer bug: `String.replace` expanded `$'` inside the uninstall script; fixed with replacer functions and a test

## 4. Docker

- [x] 4.1 Add MinGW and the Windows target to the `module` stage and copy the DLL into the runtime image; verify `docker build` succeeds and the image holds the three module files
- [x] 4.2 Update the `stack` skill (`references/docker.md`, `references/workspaces.md`, `references/commands.md`) for the Windows target, the PowerShell scripts and their test; verify every cited path exists

## 5. Frontend

- [x] 5.1 Connect dialog: Linux/Windows choice with `SegmentedPicker`, preselected from the user agent, Windows note on supported browsers; verify `check-types`, model tests for the OS detection, `bun run tailwind:check`

## 6. Wrap-up

- [ ] 6.1 Ask the user to connect Firefox on a Windows x86_64 computer with the PowerShell command, sign in to a site with the certificate not installed in Firefox, and confirm the TOTP prompt and the "Acceso con certificado" trace; record the outcome here — 2026-10-18: not done; archived at the user's request before any run on a real Windows computer (the PowerShell scripts were only tested with PowerShell 7 on Linux)
- [x] 6.2 Run `openspec validate browser-token-windows-firefox --strict`; verify it passes
