## Why

The browser certificate token works on Linux with Firefox, its derivatives and Chromium. The user also wants it on Windows. On Windows, Firefox and the browsers built on it still use NSS and load PKCS#11 modules, so the existing module and backend carry over almost unchanged; Chrome, Edge and Brave use the Windows certificate store and a CNG key storage provider instead, a much larger piece of work left out of this change.

## What Changes

- The module builds for **Windows x86_64** (`garabato_pkcs11.dll`), cross-compiled with MinGW in the backend image's module stage, and reads its configuration from `%APPDATA%\Garabato` and logs to `%LOCALAPPDATA%\Garabato`.
- Garabato serves the Windows module and a **PowerShell install script** (`irm '<url>' | iex`) that mirrors the Linux one: same one-time code, same redeem, same hash check. It registers "Garabato" by editing each Firefox-family profile's `pkcs11.txt`, since NSS's `modutil` is not on Windows, and leaves an uninstall script.
- "Conectar navegador" shows the **Linux and the Windows command**, picking the operating system the page runs on first, and says that on Windows only Firefox and its derivatives are supported.
- `startConnection` answers both commands; `redeem`, `module` and `installScript` take an optional `os` (`linux` by default, so the Linux script keeps working unchanged).
- Out of scope: Chrome, Edge and Brave on Windows; Windows on ARM; code signing of the DLL; macOS.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `browser-certificate-token`: the module also targets Windows x86_64 (Firefox family); install codes answer both commands; downloads serve the Windows module; the connect dialog offers both commands; new requirement for the Windows install script.
- `docker-production-deployment`: the backend image also ships the Windows module.

## Impact

- `native/pkcs11/src/config.rs` and `src/log.rs`: per-OS directories; the owner-only check stays Linux-only (Windows keeps `%APPDATA%` private by its ACLs). `Cargo.toml`/`Cargo.lock` may need the Windows target's dependencies.
- `native/pkcs11/install/install.ps1` and `uninstall.ps1` (new), tested in a PowerShell container against real NSS databases.
- `packages/api`: `src/shared/token-module.ts` (Windows file and script rendering), `src/v1/certificate-token/` (`os` inputs, both commands).
- `apps/backend/Dockerfile`: MinGW and the `x86_64-pc-windows-gnu` target in the module stage; runtime copies the DLL.
- `apps/frontend`: the connect dialog's command shows a Linux/Windows choice.
- No database migration, no new environment variable.
- Unsigned DLL: SmartScreen does not gate `irm | iex`, but antivirus software may flag the download; documented, not solved.
