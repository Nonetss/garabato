## Context

- Auth is Better Auth 1.7.7 (`packages/auth/src/index.ts`) with email/password always open for sign-up, the admin, API-key and organization plugins, and an optional generic OIDC provider (`packages/auth/src/oauth.ts`). The public `v1.authConfig.get` procedure already tells the sign-in page whether SSO is configured (`ssoEnabled`); the frontend reads it with `useAuthConfig()` in the sign-in slice.
- The admin seed (`packages/db/src/seed/admin.ts`) creates the admin through `auth.api.signUpEmail` and then sets `role = "admin"`. Better Auth's sign-up route throws whenever `emailAndPassword.disableSignUp` is set, even when called server-side, so the seed would break if sign-up were simply turned off.
- Better Auth's admin `createUser` endpoint allows a server-side call with no request or headers, and is gated by the `user:create` permission when a session is present. The admin users page (`features/admin/users/components/create-user-dialog.tsx`) already uses it, so admins can create accounts with sign-up closed.
- Request bodies are capped per oRPC handler by `RequestLimitHandlerPlugin` (`apps/backend/src/routers/handler-plugins.ts`): 1 MiB, or 21 MiB for `/v1/document/upload`. `Bun.serve` in `apps/backend/src/index.ts` sets no `maxRequestBodySize`, so Bun's 128 MiB default applies to everything else (`/api/auth/*`, docs).
- The heavy document procedures (`packages/api/src/v1/document/handler.ts`) hold whole PDFs in memory: upload parses with pdf-lib and seals, sign/editPages decrypt, rewrite and re-seal, merge decrypts up to 60 MiB of sources, verifySignatures decrypts and runs the CMS checks. Nothing limits how many of these one user runs.
- The cron scheduler is single-instance by design, so the backend already assumes one process.

## Goals / Non-Goals

**Goals:**

- Let the operator close self-service sign-up with one env variable, defaulting to open, without breaking the admin seed or admin-created accounts.
- Offer TOTP two-factor authentication that each user can turn on from their profile, with backup codes and trusted devices.
- Cap request bodies at the Bun level, and bound per-user concurrency and rate on the heavy document procedures.

**Non-Goals:**

- Forcing 2FA on anyone (globally, per role or per organization), OTP by email or SMS, passkeys.
- An admin action to reset another user's 2FA. A user who loses both the app and the backup codes is recovered by an operator in the database (documented as a risk).
- A distributed or persistent rate limiter (Redis, database). The backend is single-instance.
- Limits on light procedures, on `download`, or on Better Auth's own endpoints (Better Auth keeps its built-in rate limiter).
- Generating, editing or applying migrations: the user does that.

## Decisions

### 1. `DISABLE_SIGN_UP` as a validated boolean, applied in Better Auth

`packages/env/src/server.ts` gains `DISABLE_SIGN_UP: z.stringbool().default(false)`. zod 4's `stringbool` accepts `true/false/1/0/yes/no/on/off` and rejects anything else, so a typo fails at startup instead of silently leaving sign-up open. `packages/auth` passes it to `emailAndPassword.disableSignUp`, and to the OIDC provider's `disableImplicitSignUp`, so SSO cannot create accounts either.

*Alternatives:* a frontend-only switch (hiding the form) — rejected, because the endpoint would stay open to anyone calling `/api/auth/sign-up/email`. An inverted `ENABLE_SIGN_UP=true` default — rejected, because the user asked for `disableSignUp` defaulting to `false`.

### 2. Admin seed through `auth.api.createUser`

The seed calls `auth.api.createUser({ body: { email, password, name, role: "admin" } })` server-side (no headers), which works with sign-up closed and sets the role in the same write, removing the follow-up `UPDATE`. The `AuthLike` type in `seed/admin.ts` changes to that method's shape. The existence check stays as it is.

*Alternative:* temporarily toggling `disableSignUp` or writing through the internal adapter — rejected, because the first is not possible at runtime and the second bypasses password hashing and hooks.

### 3. `signUpEnabled` on `v1.authConfig.get`

The output gains `signUpEnabled: boolean`. The sign-in content hides its `/signup` link when it is false. The sign-up page reads the same query and, when it is false, renders a "registro cerrado" state with a link to `/login` instead of the form. The Astro page and the middleware stay unchanged, because the server already refuses the request. The `useAuthConfig` hook moves from the sign-in slice to a shared place in `features/auth`, since it now has two slice consumers.

### 4. Two-factor with Better Auth's `twoFactor` plugin (TOTP + backup codes)

- **Server:** `twoFactor({ issuer: "Garabato" })` in `packages/auth`. OTP by email is not configured (there is no mail sender). Trusted devices use the plugin's built-in 30-day cookie. The plugin brings its own throttling of wrong codes (`failedVerificationCount`/`lockedUntil`).
- **Schema:** `packages/db/src/schema/auth/auth.ts` gains `user.twoFactorEnabled` (`boolean`, default `false`) and a `twoFactor` table (`id`, `secret`, `backupCodes`, `userId` → `user.id` on delete cascade, `verified` default `true`, `failedVerificationCount` default `0`, `lockedUntil` nullable), with indexes on `secret` and `userId`. These match the plugin's schema in 1.7.7, cross-checked against `@better-auth/cli generate`'s output. The user generates and applies the migration.
- **Client:** `twoFactorClient()` is added to `apps/frontend/src/lib/auth-client.ts`, without `onTwoFactorRedirect`. `useSignIn` checks `data.twoFactorRedirect` in `onSuccess` and switches the form to a code step, so everything stays on `/login` with no new route.
- **Code step:** a 6-digit input (`inputMode="numeric"`, `autoComplete="one-time-code"`), a "usar un código de respaldo" toggle that calls `verifyBackupCode` instead of `verifyTotp`, and a "confiar en este dispositivo 30 días" checkbox (`trustDevice`).
- **Profile:** a two-factor section in `features/profile/overview` showing a `StatusTag` (on/off) and actions that open dialogs, all reusing `Dialog`, `Input`, `Button`, `Checkbox` and `Text`:
  - Enable: password → `twoFactor.enable` → QR code of `totpURI` plus the secret and backup codes → `verifyTotp` to confirm.
  - Disable: password → `twoFactor.disable`.
  - New backup codes: password → `generateBackupCodes`.
  - Users without a credential account see the SSO explanation instead of the actions. The profile already reads accounts or can list them with `authClient.listAccounts`.
- **QR rendering:** a small dependency that renders an SVG locally (`react-qr-code`), so the secret never leaves the browser.

*Alternatives:* a separate `/login/2fa` route with `onTwoFactorRedirect` — rejected, because the in-place step needs no new surface or middleware change. A hosted QR service — rejected, because it would leak the TOTP secret.

### 5. `Bun.serve({ maxRequestBodySize: 25 MiB })`

A constant next to the other limits in `apps/backend/src/index.ts`, documented as "above `MAX_UPLOAD_BODY_BYTES` so the per-procedure 413s keep answering first".

### 6. Per-user heavy-operation limiter as a document-feature builder

- **Limiter:** `packages/api/src/v1/document/operation-limit.ts` holds a pure `createOperationLimiter({ maxConcurrent, maxStarts, windowMs, now })`. It keeps a `Map<userId, { running, starts[] }>` and exposes `tryAcquire(userId)`, which returns a release function or `null`. The clock is injected so tests are hermetic.
- **Middleware:** an `o.middleware` acquires a slot for `context.user.id` and throws `errors.TOO_MANY_REQUESTS({ message: "Tienes demasiadas operaciones con documentos en curso; espera un momento y vuelve a intentarlo" })` when it cannot. It releases the slot in `finally` around `next()`.
- **Builder:** the file exports `heavyDocumentProcedure = protectedProcedure.use(limit)`. The five procedures in `document/router.ts` swap `protectedProcedure` for it. The builder keeps the `protected` access stamp.
- **Values:** 2 concurrent, 30 starts per 60 s, stored as named constants. Entries whose window is empty and that have nothing running are deleted on access, so the map does not grow without bound.
- **Placement:** the limiter stays inside the document feature because it is its only user, per the layering rule. It moves to `src/shared/` when a second feature needs it.
- **Timing:** oRPC has decoded the body by the time the middleware runs, so an upload refused with 429 has already been received (at most 21 MiB). The parse, decrypt and seal work it avoids is the expensive part.

*Alternatives:* queueing over-limit calls instead of refusing them — rejected, because queued uploads keep their bodies in memory, which is the cost being bounded. Better Auth's rate limiter — it only covers `/api/auth/*`. Limiting `download` — rejected, because the library fetches many thumbnails at once.

## Risks / Trade-offs

- [A user loses the authenticator and all backup codes] → An operator clears `user.two_factor_enabled` and deletes their `two_factor` row in the database. This is noted in the README's auth section. An admin reset action is a possible follow-up.
- [The plugin schema or the generated migration differs from what is written by hand] → Cross-check the Drizzle schema against `@better-auth/cli generate` before handing over. The user generates the migration from the schema, and the backend refuses to start if the tables do not match at sign-in time, which a quick sign-in with 2FA on reveals.
- [`stringbool` rejects a value that operators expect to work, such as `TRUE`] → zod's `stringbool` is case-insensitive. `.env.example` documents `true`/`false`.
- [The in-memory limiter resets on restart and is not shared across instances] → Acceptable, because the backend is single-instance (like cron). A restart briefly lifts the limit, which only matters to an attacker who can also restart the server.
- [Legitimate bursts, such as signing many documents in a row from the UI, reach 30 per minute] → The UI runs these one at a time. 30 per minute is far above manual use, and the constant is easy to raise.
- [API keys and SSO bypass 2FA] → This is intended and stated in the spec. API keys are a separate credential, and SSO MFA belongs to the IdP.
- [`DISABLE_SIGN_UP=true` with OIDC configured blocks first-time SSO users] → This is intended. An admin creates the account first, with the same email, and the OIDC account then links on sign-in. If linking by email is not enabled for that provider, that is a follow-up to discuss with the user.

## Migration Plan

1. The agent edits the auth schema, the env, auth, seed, API, backend and frontend, with tests and docs.
2. The user generates and applies the migration for `two_factor` and `user.two_factor_enabled` (`bun run db:generate`, then `db:migrate`).
3. Deploy. `DISABLE_SIGN_UP` defaults to `false`, so nothing changes until the operator sets it.
4. Rollback: revert the code. The extra table and column are harmless if left in place, or the user drops them with a down migration.

## Open Questions

- Should OIDC sign-in link to an admin-created account by email when sign-up is disabled (`accountLinking`)? The current config is to be checked during implementation, and the user decides whether to enable it.
- Should admins be able to see which users have 2FA on, or reset it, from the admin users page? Out of scope here, but cheap to add later.
