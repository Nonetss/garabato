## 1. Types

- [ ] 1.1 Add the new values to `TRACE_TYPES` and the detail shapes to `TraceDetails` in `packages/db/src/schema/trace/trace.ts` (asked for in this request; no migration); verify `check-types` and that nothing appears under `packages/db/src/migrations/`
- [ ] 1.2 Trail output and mapping for the new types in `v1/trace` (`output.ts`, `handler.ts`); verify trace handler tests for each new shape and a malformed one

## 2. Browser token traces

- [ ] 2.1 `redeem` (connected; install refused as used/expired with its owner), `revokeKey` (disconnected), `unlock` (unlocked; failed with wrong code / locked out), `lock` (locked); verify certificate-token handler tests for each trace and that unknown codes and other refusals write none

## 3. Account traces

- [ ] 3.1 Spike: a Better Auth `hooks.after` middleware observing `/sign-in/email` (ok and failed), `/sign-out`, `/update-user`, `/change-password`, `/two-factor/*`; verify with tests against the real `auth` instance which paths and context fields 1.7.7 exposes
- [ ] 3.2 Shared trace writer usable from `packages/auth` (IP from headers), with `recordTraces` delegating to it; verify its unit test and that the existing trace tests still pass
- [ ] 3.3 Record every account trace of the delta spec, never storing a password or code; verify a test per trace and that an unknown email writes none
- [ ] 3.4 Run `bun run check-types`, Biome and `bun run test`; verify all pass

## 4. Frontend

- [ ] 4.1 Labels, icons, tone, description and detail rows for the new types; verify the traces model tests (`labels.test.ts`) and `check-types`

## 5. Wrap-up

- [ ] 5.1 Ask the user to sign in, fail a password, connect and unlock a browser with a wrong and a right code, and check `/traces`; record the outcome here
- [ ] 5.2 Run `openspec validate trace-browser-and-account-actions --strict`; verify it passes
