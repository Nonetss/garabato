## Context

See proposal.md. Starting point (all archived): the token procedures in `packages/api/src/v1/certificate-token/`; install codes, module files and script rendering in `src/shared/install-codes.ts` and `src/shared/token-module.ts`; the Rust module in `native/pkcs11` (Linux paths in `src/config.rs` and `src/log.rs`, owner-only check through `std::os::unix`); `install/install.sh` + `uninstall.sh`; the backend image's `module` stage building both Linux targets. Firefox and its derivatives on Windows load PKCS#11 modules listed in each profile's `pkcs11.txt`, where an external module is two lines (`library=<path>` and `name=<name>`) in a blank-line separated block. This machine has no Windows toolchain, PowerShell or Wine: building and script tests run in Docker (the user agreed), and the final check runs on the user's Windows computer.

## Goals / Non-Goals

**Goals:**
- Same flow as Linux on Windows: one pasted command, same one-time code, same redeem and hash check, no administrator rights.
- The Linux script and module keep working unchanged.

**Non-Goals:**
- Chrome, Edge and Brave on Windows (CNG key storage provider plus certificate store sync); Windows on ARM; signing the DLL or the script; Flatpak-like sandboxes (Windows Store builds of Firefox are not detected).

## Decisions

### Cross-compile with MinGW in the existing module stage

Add `gcc-mingw-w64-x86-64` and the `x86_64-pc-windows-gnu` target to the `module` stage, build the three targets in one `cargo build`, and copy `target/x86_64-pc-windows-gnu/release/garabato_pkcs11.dll` to `/dist/windows-x86_64/`. `RUSTFLAGS` for that target carry `-C target-feature=+crt-static` so the DLL needs no `libgcc_s`/`libwinpthread` beside it; a task checks its imports with `x86_64-w64-mingw32-objdump -p` (only system DLLs). `native-pkcs11` pulls `native-pkcs11-windows` on Windows targets; if it does not build with the GNU toolchain, the first task finds out and the fallback is to vendor-patch the dependency away (the module never uses that backend).

*Alternative:* MSVC via `cargo-xwin` (downloads the Windows SDK at build time, licence questions, larger stage).

### Per-OS directories in the module

`config.rs` gains `config_dir()`/`state_dir()` that resolve `%APPDATA%\Garabato` and `%LOCALAPPDATA%\Garabato` on Windows and keep the XDG paths elsewhere. The resolution is a pure function of an `Os` value and an environment lookup, so both branches are unit-tested on Linux. The owner-only check stays `#[cfg(unix)]`: on Windows `%APPDATA%` is private to the user by default ACLs.

### One API, an `os` field

`startConnection` answers `commands: { linux, windows }` instead of `command`. `redeem`, `module` and `installScript` accept `os: "linux" | "windows"`, defaulting to `linux`, so the Linux script already in use keeps working. Module files: Linux stays at `dist/<arch>/libgarabato_pkcs11.so`; Windows lives at `dist/windows-x86_64/garabato_pkcs11.dll`. `token-module.ts` maps `(os, arch)` to that path and refuses `(windows, aarch64)`. The Windows command:

```powershell
irm 'https://garabato.lan/api/v1/certificateToken/installScript?code=7KQ4XMPA&os=windows' | iex
```

### The PowerShell script

`install/install.ps1` and `uninstall.ps1`, with the same placeholders (`@@URL@@`, `@@CODE@@`, `@@UNINSTALL@@`; the uninstall script goes inside a single-quoted here-string). Written for Windows PowerShell 5.1, the version every Windows ships: no `??`, ternaries or `&&`, `Invoke-WebRequest -UseBasicParsing`, and TLS 1.2 enabled on `ServicePointManager` first. Order, as on Linux: check the processor (`PROCESSOR_ARCHITECTURE` = `AMD64`), find profiles, wait for running browsers (`Get-Process firefox, zen, librewolf, floorp, waterfox`), download, redeem, check the hash, move the module into place, write the configuration, register, write the uninstall script, print the result.

Profiles: for each root (`%APPDATA%\Mozilla\Firefox`, `%APPDATA%\zen`, `%APPDATA%\librewolf`, `%APPDATA%\Floorp`, `%APPDATA%\Waterfox`), every folder under `Profiles\` with a `pkcs11.txt`, plus the `Path=` entries of `profiles.ini` (relative ones resolved against the root, forward slashes allowed). A profile without `pkcs11.txt` has not been opened yet and is reported, not created, because a file holding only our entry would leave out NSS's internal module.

Registering: read `pkcs11.txt`, split it into blank-line separated blocks, drop any block with `name=Garabato`, append `library=<dll path>` + `name=Garabato`, and write it back keeping the file's line ending (CRLF or LF) and UTF-8 without a byte-order mark (`[IO.File]::WriteAllText` with `UTF8Encoding($false)`; PowerShell 5.1's `Set-Content -Encoding UTF8` would add one). Uninstall drops the block the same way.

### Tests in Docker

`native/pkcs11/tests/install-windows/run.sh` runs `install.ps1` with `pwsh` in a `mcr.microsoft.com/powershell` container (host network, plus `libnss3-tools` for checking), against the existing stub server on the host extended with the Windows endpoints. `APPDATA`, `LOCALAPPDATA` and `PROCESSOR_ARCHITECTURE` point at a throwaway tree with real NSS profiles (created with `certutil`); the checks read `pkcs11.txt` and run `modutil -list` on it, so NSS itself confirms the edited file parses. A CRLF profile and a profile kept elsewhere through `profiles.ini` are covered. This runs PowerShell 7, not 5.1; the 5.1 constraints above are kept by review, and the user's Windows run is the 5.1 check.

### Frontend

The pending step shows a Linux/Windows choice (the shared `SegmentedPicker`) above the command, preselected from `navigator.userAgent`, with the Windows note about supported browsers.

## Risks / Trade-offs

- [`native-pkcs11-windows` or `ring` fails to cross-compile] → first task; fallbacks above.
- [PowerShell 5.1 differences the pwsh 7 test cannot catch] → conservative syntax, and the user's run on Windows.
- [Unsigned DLL flagged by antivirus] → documented in the dialog note; signing is out of scope.
- [Private CA on Windows] → the module uses the Windows certificate store (`rustls-native-certs`); a self-signed Garabato needs its CA imported there, like on Linux.
- [Firefox rewrites `pkcs11.txt` on exit] → the script waits for the browsers to close before editing, as on Linux.

## Migration Plan

Rebuild and deploy the backend image (it now carries the DLL). Linux connections are unaffected; the Linux command keeps the same URL shape (`os` defaults to `linux`).
