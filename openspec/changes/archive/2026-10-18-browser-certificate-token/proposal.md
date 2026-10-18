## Why

Entering public-administration sites (Agencia Tributaria, Cl@ve, university enrolment) with an electronic certificate today needs the certificate installed in the browser, a second copy of the private key outside Garabato. Garabato already keeps the user's certificates encrypted; letting the browser sign the TLS client-authentication handshake through Garabato keeps one copy of the key, behind the user's second factor. A spike (`spikes/pkcs11`) proved the path with NSS, the library Firefox and Chromium use on Linux: a PKCS#11 module forwarding signatures to a remote signer completes TLS 1.2 and 1.3 client authentication, NSS asks for the token PIN once and signs once per new TLS session (resumed sessions sign nothing), and Node's crypto can produce the RSA-PSS signature over a precomputed hash that TLS 1.3 needs.

## What Changes

- New **browser certificate token**: a PKCS#11 module (`native/pkcs11`, Rust on `native-pkcs11`) that Firefox or Chromium on Linux loads as a security device. It shows the user's usable Garabato certificates as if they were on a smart card and forwards every signature to the backend; the private key never leaves the server.
- The token's PIN is the user's **TOTP code**. A valid code opens a **15-minute signing window** for that user; outside it the backend refuses to sign. Two-factor authentication is required to use the token, and repeated wrong codes are rate-limited.
- Only certificates that are not deleted, are within their validity period and have a **remembered password** are offered through the token.
- New **token keys**: a signed-in user creates, lists and revokes, from the certificates page, the keys a browser module uses to reach Garabato ("Conectar navegador"). A token key is a Better Auth API key restricted to the token procedures: it never opens a general session.
- New procedures under `v1.certificateToken`: create/list/revoke token keys (session), and list certificates, unlock, lock and sign (token key). Signing supports `CKM_RSA_PKCS` (DigestInfo) and `CKM_RSA_PKCS_PSS` over a precomputed hash, RSA keys only.
- Every signature made through the token is traced as a new trace type, "certificate used to sign in", shown on `/traces` as "Acceso con certificado".
- `spikes/pkcs11` is removed once the module replaces it.

## Capabilities

### New Capabilities
- `browser-certificate-token`: token keys, the TOTP unlock and its signing window, the certificate list and raw signing procedures, the PKCS#11 module's behaviour in the browser, and the "Conectar navegador" flow on the certificates page.

### Modified Capabilities
- `activity-traces`: a new trace type for signatures made through the token, with its label, icon, sentence and detail on the traces page.
- `api-key-management`: an API key restricted to the token procedures does not resolve to a session.

## Impact

- `packages/api`: new feature folder `src/v1/certificate-token/` (input, output, handler, router) and its key in `src/v1/router.ts`; reuse of `openCertificateFile`/`openRememberedPassword` (`src/shared/certificate-secrets.ts`), the PKCS#12 opener (`src/shared/pkcs12.ts`) and the trace helper (`src/shared/trace.ts`); TOTP verification against the secret Better Auth's `twoFactor` plugin stores.
- `packages/db`: `TraceType` and `TraceDetails` gain the new type. `trace_event.type` is text and `details` is `jsonb`, so **no migration** is needed; token keys reuse the existing `apikey` table.
- `apps/backend`: session resolution skips token keys.
- `apps/frontend`: "Conectar navegador" on `/certificates`; the new trace type on `/traces`.
- New directory `native/pkcs11` (Rust crate, not a Bun workspace; built with `cargo`), documented in the `stack` skill's `references/workspaces.md`. New Rust dependencies: `native-pkcs11`, `native-pkcs11-traits`, `pkcs11-sys`, an HTTP client.
- Platforms: Linux (NSS: Firefox and Chromium). Windows (CNG) and macOS (CryptoTokenKit) are out of scope.
