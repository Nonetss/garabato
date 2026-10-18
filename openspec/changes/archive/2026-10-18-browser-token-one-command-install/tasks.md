## 1. Backend: install codes and files

- [x] 1.1 Spike file responses: a `publicProcedure` returning a `File`, called with `call()` and through the OpenAPI handler; verify the body and content type arrive intact, or switch the two file endpoints to Hono routes as design.md says
- [x] 1.2 Add `src/shared/install-codes.ts` (generate, normalise `7KQ4-XMPA`, store with injectable clock, single-use redeem, status kept until expiry) and verify its unit tests: alphabet and length, case and dash tolerance, expiry, single use, per-user status
- [x] 1.3 Add the module file lookup (`../../native/pkcs11/dist/<arch>/libgarabato_pkcs11.so`, SHA-256 cached) and verify unit tests with a temp directory for present, missing and unknown architectures
- [x] 1.4 Replace `createKey` with `startConnection` (session, 2FA required) and `connectionStatus`; add `redeem`, `installScript` and `module`; verify handler tests: 2FA off → conflict, redeem creates the key with the stored name and returns url/key/hash, second redeem and expired code rejected without creating a key, status pending/connected/expired and another user's → not found, script built with URL and code for a valid code and the expired script otherwise, module download and not found
- [x] 1.5 Run `bun run check-types`, Biome and `bun run test`; verify all pass and `/openapi.json` generation lists the new procedures

## 2. Install script

- [x] 2.1 Write `native/pkcs11/install/install.sh` and `uninstall.sh` per design.md; verify `sh -n` and, when available, `shellcheck` (not installed here: `sh -n` only)
- [x] 2.2 Add `native/pkcs11/tests/install/run.sh`: a stub server (redeem + module), a temp `HOME` with a fake Firefox profile and a real NSS database; verify install registers "Garabato" in both databases, writes the config with mode 600, never prints the key, refuses an expired code, stops without `modutil` before redeeming, and uninstall removes everything
- [x] 2.3 Add `native/pkcs11/scripts/build-dist.sh` (host architecture into `dist/<arch>/`) and ignore `native/pkcs11/dist/`; verify it produces the file the backend serves

## 3. Docker

- [x] 3.1 Add the `module` stage to `apps/backend/Dockerfile` (bookworm, both targets, cache mounts) and copy the two files into the runtime stage; verify `docker build -f apps/backend/Dockerfile .` succeeds, both files exist in the image and `file` reports x86-64 and aarch64 ELF shared objects — run only with the user's permission, since it builds Docker images — 2026-10-18: built with the user's permission; the image holds x86-64 and aarch64 ELF modules (both need glibc ≥ 2.34) plus `install/`, no Rust toolchain; the test image was removed
- [x] 3.2 Update the `stack` skill (`references/docker.md`, `references/workspaces.md`, `references/commands.md`) for the module stage, the served files and the install scripts; verify every cited path exists

- [x] 3.3 Serve the module from the Docker dev stack too: `compose.dev.yml` mounts `./native/pkcs11/dist` read-only on the backend and syncs `native/pkcs11/install` (found when the user's first run got a 404 on the module download); verify `docker compose -f compose.dev.yml config` and `references/docker.md`

## 4. Frontend

- [x] 4.1 Connect dialog: name form → command with copy, formatted code and countdown → polling `connectionStatus` → connected or expired with "Generar otro comando"; remove `BrowserConnectedDialog` and the manual-step helpers and their tests; verify `check-types`, the model tests for the command and code formatting, and `bun run tailwind:check`

## 5. Wrap-up

- [x] 5.1 Ask the user to connect a laptop with the command against their Garabato and record the outcome here — 2026-10-18: installed with the one command against the Docker dev stack (after the 3.3 fix); Firefox 158 completed TLS 1.3 client authentication with the user's FNMT certificate on certauth.cryptomix.com — CORRECTION (2026-10-18): not confirmed. The user's browser is Zen, where the module was never registered (`browser-token-firefox-derivatives`), and the backend received no certificates/unlock/sign request; the site authenticated with the certificate installed in the browser
- [x] 5.2 Run `openspec validate browser-token-one-command-install --strict`; verify it passes
