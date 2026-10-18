## Context

See proposal.md for the motivation and specs/ for the behaviour. What shapes the approach:

- Certificates are stored sealed (`packages/api/src/shared/vault.ts`); `openCertificateFile` and `openRememberedPassword` (`src/shared/certificate-secrets.ts`) unseal them and `src/shared/pkcs12.ts` turns the PKCS#12 into a `node:crypto` private key. PAdES signing (`v1/document`) already follows that path.
- `apps/backend/src/middlewares/auth.ts` resolves every request to a session with `auth.api.getSession`, which turns any valid `x-api-key` into a full session (`enableSessionForAPIKeys`). API keys are created only by admins today (`v1.apiKey`).
- Better Auth's `twoFactor` plugin keeps each user's TOTP secret in `two_factor.secret`, encrypted with `symmetricDecrypt`/`symmetricEncrypt` (`better-auth/crypto`) under `BETTER_AUTH_SECRET`; codes are 6 digits over 30 s (`createOTP` from `@better-auth/utils/otp`).
- `trace_events.type` is `text` typed by `TRACE_TYPES` and `details` is `jsonb` typed by `TraceDetails` (`packages/db/src/schema/trace/trace.ts`): a new type is a TypeScript change, not a migration.
- The backend is a single instance (the cron scheduler already relies on it).
- Spike findings (`spikes/pkcs11`): NSS asks for the PIN once and signs once per new TLS session, resumed sessions sign nothing; with a wrong PIN NSS retries `C_Login` twice per handshake; NSS hands `C_Sign` a correctly sized buffer (the double signature of `native-pkcs11` only showed with GnuTLS); `native-pkcs11` reports a protected authentication path, accepts any `C_Login` and always reports logged-in sessions, so those functions need wrapping; RSA-PSS over a precomputed hash works with EMSA-PSS encoding plus raw RSA in `node:crypto`.

## Goals / Non-Goals

**Goals:**
- No database migration: reuse the `apikey` table and the text/jsonb trace columns.
- The PKCS#12 and its password are unsealed only inside the sign procedure, as in PAdES signing.
- A stolen token key alone can neither sign nor read anything beyond the list of certificates offered through the token.

**Non-Goals:**
- Windows (CNG key storage provider) and macOS (CryptoTokenKit).
- EC certificates, `CKM_ECDSA`, TLS 1.0/1.1 (MD5+SHA-1 `CKM_RSA_PKCS`) and `CKM_SHA*_RSA_PKCS` (the module hashes nothing).
- Sites that sign through AutoFirma instead of TLS client authentication.
- Surviving a backend restart with windows open: the code is asked again.
- Packaging (AUR, `.deb`): the module is built with `cargo` and its path given to the browser.

## Decisions

### Token keys are Better Auth API keys with a `certificateToken` permission

Created server-side with `auth.api.createApiKey({ body: { userId, name, expiresIn, permissions: { certificateToken: ["use"] } } })`. The session middleware, when the request carries `x-api-key`, verifies the key once; if it holds that permission, it resolves the session from the headers without `x-api-key`, so a token key never becomes a session (`api-key-management` delta). The token procedures are built on a new `tokenProcedure` builder in `packages/api/src/index.ts` that reads `x-api-key`, verifies it with `auth.api.verifyApiKey({ body: { key, permissions: { certificateToken: ["use"] } } })`, loads the owner, checks `twoFactorEnabled` and puts `{ tokenKey: { id, name }, user }` in the context; it stamps its own `access` meta (`"token"`).
Listing and revoking filter the caller's keys by that permission.

*Alternatives:* a new `browser_token` table (cleaner, but a migration and a second credential system); plain admin API keys (any of them opens a full session, so a key stolen from the module's config file would expose documents and settings).

### The signing window lives in memory, keyed by token key

`Map<tokenKeyId, expiresAt>` in `src/shared/` (with an injectable clock for tests). Unlock sets `now + 15 min`, lock and revoke delete the entry, sign checks it. Replay protection keeps the last accepted TOTP counter per user; failure counting keeps a list of failure times per user and refuses while 5 fall within the last 15 minutes. A restart loses windows and counters: the browser asks for the code again, which is safe.

*Alternative:* a table (survives restarts, needs a migration; not worth it for a 15-minute window).

### TOTP verified against the plugin's secret, not through its endpoint

The plugin's `verifyTOTP` endpoint needs a session cookie and sets cookies, so the handler reads `two_factor.secret` for the key owner, decrypts it with `symmetricDecrypt({ key: env.BETTER_AUTH_SECRET, data })` and checks the code with `createOTP(secret, { digits: 6, period: 30 })`. To reject replays it computes which 30-second step matched (current, previous or next) and compares with the last accepted step. Backup codes live in another column and are never read.

### Raw signing in `src/shared/raw-signature.ts`

- `rsa-pkcs1`: the data must be a DER DigestInfo whose prefix matches SHA-256, SHA-384 or SHA-512 and whose digest has that length; signed with `privateEncrypt(RSA_PKCS1_PADDING)`.
- `rsa-pss`: the data must have the hash length; EMSA-PSS-ENCODE (RFC 8017 §9.1.1) with MGF1 over the same hash and the requested salt, then `privateEncrypt(RSA_NO_PADDING)`.
The spike's self-test becomes the unit test: each output verifies with `crypto.verify` over the original message.

### Procedures and HTTP

Feature folder `packages/api/src/v1/certificate-token/`, key `certificateToken` in `src/v1/router.ts`:

| Procedure | Builder | Method | Notes |
|---|---|---|---|
| `createKey` | protected | POST 201 | refuses without 2FA (`CONFLICT`, the account state refuses) |
| `listKeys` | protected | GET | |
| `revokeKey` | protected | DELETE | also closes the window |
| `certificates` | token | GET | DER as base64 |
| `unlock` | token | POST | wrong code `BAD_REQUEST`, lockout `TOO_MANY_REQUESTS` |
| `lock` | token | POST | |
| `sign` | token | POST | closed window `FORBIDDEN`, certificate not offered `NOT_FOUND`, malformed data `BAD_REQUEST` |

The trace is written with the existing helper in the same transaction as nothing else (signing writes no other row); type `certificate.usedToSignIn`, `certificateId`, IP from `src/shared/client-ip.ts`, details `{ key: { id, name } }`.

### Module: `native/pkcs11`, evolved from the spike

Same structure as `spikes/pkcs11/src/lib.rs`: a `Backend` over HTTP (`ureq`) plus wrapped `C_GetTokenInfo`, `C_Login`, `C_Logout`, `C_GetSessionInfo`, `C_FindObjectsInit`, `C_Finalize`. Changes from the spike:
- Config at `$XDG_CONFIG_HOME/garabato/token.json` (`{ "url", "key" }`), file mode checked to be owner-only, otherwise the token is empty and the log says why.
- Several certificates: one object set per certificate; the list is cached for 60 s.
- `C_Login` → `unlock`; `BAD_REQUEST`/`TOO_MANY_REQUESTS` → `CKR_PIN_INCORRECT`/`CKR_PIN_LOCKED`.
- `sign` answered `FORBIDDEN` → clear the logged-in flag and return `CKR_USER_NOT_LOGGED_IN`.
- `C_Logout`/`C_Finalize` → `lock` (best effort).
- Log to `$XDG_STATE_HOME/garabato/pkcs11.log`, never PIN nor key.
- The spike's signature reuse window is kept (cheap protection against callers that size the buffer by signing).
Crate tests: `cargo test` for config parsing and mechanism mapping; the NSS client and `local-test.sh` move to `native/pkcs11/tests/` as the end-to-end check, run by hand (needs `cargo`, `cc`, NSS headers), not by `bun run test`.

### Frontend

A "Conectar navegador" button on `/certificates` opening a `FormDialog` (name), then a dialog with the config JSON (copyable) and the Firefox and Chromium steps; a "Navegadores conectados" section listing keys with disconnect via the shared confirmation. Before writing them, search `components/shared` and the certificates feature slices for the copy field, confirmation and list row to reuse. Traces: label "Acceso con certificado", icon, sentence and detail row for the browser name.

## Risks / Trade-offs

- [The module's config file holds a key that lists certificates] → owner-only permissions enforced; the key alone cannot sign (TOTP) and does not open a session; revocable from `/certificates`.
- [Resumed TLS sessions keep a site session alive after lock or revoke] → inherent to TLS; documented in the connect dialog. Garabato only sees new handshakes, so traces mean "new sessions", not "pages visited".
- [NSS retries a wrong PIN twice per handshake, consuming the 5-attempt budget fast] → accepted; the lockout message says when to retry.
- [Reading the `two_factor` table and `BETTER_AUTH_SECRET` couples us to Better Auth's internal storage] → isolated in one helper with a unit test; a Better Auth upgrade that changes the format fails that test.
- [`native-pkcs11` internals (the 10 s query cache, the public-key `CKA_PUBLIC_EXPONENT` bug)] → pinned version; the locked-search template keeps working with the cache; NSS reads the exponent from the certificate.
- [`TraceType` lives in `packages/db/src/schema/`] → adding the type edits a schema file without changing the database; it is called out in the tasks for the user's approval.

## Migration Plan

No database migration. Deploy the backend and frontend as usual; the module is built locally with `cargo build --release` and loaded by each user. Rollback: revoke the token keys and unload the module; old traces of the new type stay readable only if the type stays in `TRACE_TYPES`, so it is not removed on rollback.
