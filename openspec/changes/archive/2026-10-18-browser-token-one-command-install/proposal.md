## Why

Connecting a browser to the certificate token works, but it takes a Rust toolchain, a `cargo build`, a configuration file written by hand with the token key in it, and loading the module in each browser through its settings or `modutil`. That is a developer's procedure, not something to do on every laptop. Connecting a browser should be one command copied from Garabato.

## What Changes

- **BREAKING** (within the browser token): token keys are no longer created and shown on the certificates page. "Conectar navegador" now creates a **one-time install code** (valid 10 minutes, single use) and shows **one command** (`curl … | sh`). The install script redeems the code, and only then is the token key created; its value goes straight into the module's configuration file and is never shown on screen or kept in shell history.
- Garabato **serves the prebuilt module** for Linux x86_64 and ARM64. The backend production image builds both in a Rust stage, so a private-network Garabato needs neither internet nor GitHub to hand it out.
- Garabato **serves the install script**. The script detects the architecture, downloads and checks the module, redeems the code, writes the configuration (owner-only), registers the module in every Firefox profile and in Chromium's NSS database, and leaves an uninstall script next to the module. It tells the user what to install when `modutil` is missing and asks them to close the browser when it is running.
- While the dialog is open the page **shows when the browser has connected**, so the user knows the command worked.
- The manual `createKey` procedure is replaced by the install-code procedures. Listing and revoking connected browsers stays.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `browser-certificate-token`: token keys are created by redeeming an install code; new requirements for install codes, the served module and the install script; the connect flow on the certificates page becomes one command with a connected state; the module is installed by the script.
- `docker-production-deployment`: the backend image also ships the browser token module for x86_64 and ARM64.

## Impact

- `packages/api/src/v1/certificate-token/`: `createKey` replaced by `startConnection`, `connectionStatus`, `redeem` (public, code-authenticated), `installScript` and `module` (public, file responses). New in-memory install-code store in `src/shared/`.
- `native/pkcs11`: the install and uninstall scripts (`install/`), served by the backend; a `scripts/build-dist.sh` that builds the module into `native/pkcs11/dist/<arch>/` for local and Docker use.
- `apps/backend/Dockerfile`: a Rust build stage that cross-compiles the module for `x86_64-unknown-linux-gnu` and `aarch64-unknown-linux-gnu` and copies both into the runtime image. Longer image builds; no new runtime dependency.
- `apps/frontend`: the connect dialog shows the command, the code's expiry and the connected state; the one-time configuration dialog goes away.
- No database migration and no new environment variable: the script uses `CORS_ORIGIN` as Garabato's public address.
- Client requirements: Linux with `curl`, `sha256sum` and NSS's `modutil` (packages `nss`, `libnss3-tools` or `nss-tools`). Flatpak and Snap browsers cannot load a module from the home folder and are reported as unsupported.
