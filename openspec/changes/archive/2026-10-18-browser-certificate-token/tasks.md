## 1. Trace type (needs the user's OK: edits a schema file, no migration)

- [x] 1.1 Add `certificate.usedToSignIn` to `TRACE_TYPES` and `{ key: { id: string; name: string } }` to `TraceDetails` in `packages/db/src/schema/trace/trace.ts`; verify `bun run check-types` passes and `git status` shows nothing under `packages/db/src/migrations/`

## 2. Backend building blocks

- [x] 2.1 Add `src/shared/raw-signature.ts` (DigestInfo check + PKCS#1 v1.5, EMSA-PSS + raw RSA) and verify its unit tests: signatures verify with `crypto.verify` for SHA-256/384/512, wrong-length hashes and foreign DigestInfo prefixes are rejected
- [x] 2.2 Add the in-memory signing-window, replay and failure-count store in `src/shared/` with an injectable clock and verify unit tests for open/extend/expire, per-key isolation, replayed step and the 5-in-15-minutes lockout
- [x] 2.3 Add the TOTP helper that decrypts the owner's `two_factor.secret` and returns the matched time step, and verify unit tests with a secret encrypted by `symmetricEncrypt` (right, wrong, adjacent step, backup code refused)
- [x] 2.4 Add the `tokenProcedure` builder (verify `x-api-key` with the `certificateToken` permission, load owner, require 2FA, context `{ user, tokenKey }`, `access` meta `"token"`) and verify unit tests for missing key, wrong permission, 2FA off and success
- [x] 2.5 Make `apps/backend/src/middlewares/auth.ts` resolve the session without `x-api-key` when the key carries the `certificateToken` permission (and refuse token keys on `/api/auth/*`), and verify with a test that a token key gets no session while an ordinary API key still does (`sessionHeaders` in `packages/api/src/shared/token-key.ts`, since `apps/backend` has no suite)

## 3. Procedures (`packages/api/src/v1/certificate-token/`)

- [x] 3.1 `createKey`, `listKeys`, `revokeKey` (protected; 2FA required for create; revoke closes the window) wired under `certificateToken` in `src/v1/router.ts`; verify handler tests including another user's key → not found and create without 2FA → conflict
- [x] 3.2 `certificates` (token): usable certificates only (not deleted, valid now, password remembered, RSA) with DER; verify the test with the four-certificate scenario of the spec
- [x] 3.3 `unlock` and `lock` (token); verify tests for right, wrong, replayed code, lockout and per-key windows
- [x] 3.4 `sign` (token): window check, certificate check, unseal with remembered password, raw signature, trace with key id and name and client IP; verify tests for both mechanisms, closed window → forbidden and no trace, certificate not offered → not found, malformed data → bad request
- [x] 3.5 Run `bun run check-types`, Biome and `bun run test`; verify all pass and `/openapi.json` generation does not throw in the existing docs test

## 4. Browser module (`native/pkcs11`)

- [x] 4.1 Create the crate from `spikes/pkcs11/src/lib.rs` with the config file (`$XDG_CONFIG_HOME/garabato/token.json`, owner-only), several certificates, the 60 s list cache and the log in `$XDG_STATE_HOME/garabato/`; verify `cargo build --release` and `cargo test` (config parsing, mechanism mapping)
- [x] 4.2 Map `C_Login` → `unlock` (`CKR_PIN_INCORRECT`, `CKR_PIN_LOCKED`), `sign` forbidden → logged out + `CKR_USER_NOT_LOGGED_IN`, `C_Logout`/`C_Finalize` → `lock`; verify with `cargo test` against a stub HTTP server
- [x] 4.3 Move the NSS client and the end-to-end script to `native/pkcs11/tests/`, pointing at a backend URL and token key given by the user; verify the script builds and prints its usage without a backend
- [x] 4.4 Document the crate in the `stack` skill (`references/workspaces.md`, and `references/commands.md` for `cargo build`) and add `native/pkcs11/target/` to `.gitignore`; verify every path cited exists

## 5. Frontend

- [x] 5.1 Search `components/shared` and the certificates feature for a copyable field, a confirmation dialog and a list row before writing new ones; note what is reused (`CopyButton`, `FormDialog` + `useDialogForm`, `ConfirmDialog` + `useTargetConfirmDialog`, `useTargetDialog`, `SectionHeading`, `IconButton`, `AppLink`; the one-time key dialog follows `ApiKeyCreatedDialog`)
- [x] 5.2 "Conectar navegador" on `/certificates`: name dialog, one-time config + Firefox/Chromium steps, 2FA-off message linking `/me`; "Navegadores conectados" list with disconnect; verify hook/component tests and `bun run tailwind:check`
- [x] 5.3 Traces: "Acceso con certificado" label, icon, sentence and detail row with the browser name; verify the traces definition tests

## 6. Wrap-up

- [x] 6.1 Ask the user to run the end-to-end check with Firefox against their Garabato (AEAT or Cl@ve) and record the outcome here — 2026-10-18: the user reports that signing in with the module in Firefox works — CORRECTION (2026-10-18): not confirmed. The user's browser is Zen, where the module was never registered (`browser-token-firefox-derivatives`), and the backend received no certificates/unlock/sign request; the site authenticated with the certificate installed in the browser
- [x] 6.2 Delete `spikes/pkcs11`; verify `git status` shows it removed and nothing references it
- [x] 6.3 Run `openspec validate browser-certificate-token --strict`; verify it passes
