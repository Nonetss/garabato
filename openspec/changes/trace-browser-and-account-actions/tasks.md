## 1. Types

- [x] 1.1 Add the new values to `TRACE_TYPES` and the detail shapes to `TraceDetails` in `packages/db/src/schema/trace/trace.ts` (asked for in this request; no migration); verify `check-types` and that nothing appears under `packages/db/src/migrations/`
- [x] 1.2 Trail output and mapping for the new types in `v1/trace` (`output.ts`, `handler.ts`); verify trace handler tests for each new shape and a malformed one

## 2. Browser token traces

- [x] 2.1 `redeem` (connected; install refused as used/expired with its owner), `revokeKey` (disconnected), `unlock` (unlocked; failed with wrong code / locked out), `lock` (locked); verify certificate-token handler tests for each trace and that unknown codes and other refusals write none

## 3. Account traces

- [x] 3.1 Spike: a Better Auth `hooks.after` middleware observing `/sign-in/email` (ok and failed), `/sign-out`, `/update-user`, `/change-password`, `/two-factor/*`; verify with tests against the real `auth` instance which paths and context fields 1.7.7 exposes — done by reading Better Auth 1.7.7 (`api/dispatch.mjs`, `api/routes/*`, `plugins/two-factor/totp`, `plugins/admin`): after hooks also run on failure with the `APIError` in `ctx.context.returned`; a sign-in leaves `ctx.context.newSession`; with two-step on it completes in `/two-factor/verify-totp`, which also completes enrolment (with a session, flipping `twoFactorEnabled`); banned users fail with `BANNED_USER`; SSO completes in `/callback/:id` and `/oauth2/callback/:providerId`; `/sign-out` loads no session, so a before hook keeps who it was. A test against the real instance would need a real database, so the decision is a pure, tested function and the thin hook adapter is checked by the user in 5.1
- [x] 3.2 Shared trace writer usable from `packages/auth` (IP from headers), with `recordTraces` delegating to it; verify its unit test and that the existing trace tests still pass
- [x] 3.3 Record every account trace of the delta spec, never storing a password or code; verify a test per trace and that an unknown email writes none
- [x] 3.4 Run `bun run check-types`, Biome and `bun run test`; verify all pass

## 4. Frontend

- [x] 4.1 Labels, icons, tone, description and detail rows for the new types; verify the traces model tests (`labels.test.ts`) and `check-types`

## 5. Wrap-up

- [ ] 5.1 Ask the user to sign in, fail a password, connect and unlock a browser with a wrong and a right code, and check `/traces`; record the outcome here
- [x] 5.2 Run `openspec validate trace-browser-and-account-actions --strict`; verify it passes
