## 1. Environment

- [x] 1.1 Add `DISABLE_SIGN_UP: z.stringbool().default(false)` to `packages/env/src/server.ts` with a comment on what it closes and what stays open (admin-created accounts)
- [x] 1.2 Document `DISABLE_SIGN_UP=false` in `.env.example` and make `scripts/bootstrap.sh` (and `scripts/setup-dev.sh` if it writes env) emit it
- [x] 1.3 Update the env reference in the `stack` skill (`references/env.md`) if it describes the auth variables

## 2. Sign-up switch and admin seed

- [x] 2.1 In `packages/auth/src/index.ts`, set `emailAndPassword.disableSignUp` from `env.DISABLE_SIGN_UP`
- [x] 2.2 In `packages/auth/src/oauth.ts`, set `disableImplicitSignUp` on the OIDC provider from `env.DISABLE_SIGN_UP`; check the current `accountLinking` config and record the finding for the open question in `design.md`
- [x] 2.3 Change `packages/db/src/seed/admin.ts` to create the admin with `auth.api.createUser({ body: { email, password, name, role: "admin" } })`, update `AuthLike`, drop the follow-up role `UPDATE`, and adapt the seed's callers and test fakes (`packages/api/tests`, `packages/db/testing`)
- [x] 2.4 Add `signUpEnabled` to `packages/api/src/v1/auth-config/output.ts` and `handler.ts`, with a `.describe()` text and updated OpenAPI description in the router
- [x] 2.5 Unit tests: `v1.authConfig.get` returns `signUpEnabled` for both env values; run `bun run test`. (The admin seed has no unit suite: `packages/db` runs no `bun test`, and the seed reads `db` through its own `#index`, which the API preload's `@nonete/db` mock does not reach.)

## 3. Sign-up in the frontend

- [x] 3.1 Move `useAuthConfig` from `features/auth/sign-in/hooks` to a domain-local shared slice in `features/auth` (two consumers now), and update imports
- [x] 3.2 Hide the `/signup` link in `sign-in-content.tsx` when `signUpEnabled` is false
- [x] 3.3 Make the sign-up page render a closed-registration state (Spanish copy, `Text` roles, link to `/login`) instead of the form when `signUpEnabled` is false
- [x] 3.4 Run `check-types`, Biome and `bun run tailwind:check` for the frontend

## 4. Two-factor: server and schema

- [x] 4.1 Register `twoFactor({ issuer: "Garabato" })` in `packages/auth/src/index.ts`
- [x] 4.2 Add `twoFactorEnabled` to `user` and the `twoFactor` table (fields, defaults, FK with cascade and indexes per `design.md`) in `packages/db/src/schema/auth/auth.ts`, and export them where the other auth tables are exported
- [x] 4.3 Cross-check the schema against `@better-auth/cli generate` output (read-only, written to the scratchpad, never into `packages/db/src/migrations/`) and fix any difference. (The CLI could not be installed here, because `better-sqlite3` needs `node-gyp`, so the schema was checked field by field against the plugin's own `two-factor/schema.mjs` in better-auth 1.7.7.)
- [x] 4.4 Update `packages/db/testing` fixtures and rows (`rows.ts`) if they build `user` rows, so `twoFactorEnabled` is present
- [x] 4.5 **Stop and hand off to the user:** they generate and apply the migration for `two_factor` and `user.two_factor_enabled` (the user generated `20261009090336_panoramic_payback`, which matches the schema; applying it is theirs)

## 5. Two-factor: frontend

- [x] 5.1 Add `twoFactorClient()` to `apps/frontend/src/lib/auth-client.ts`
- [x] 5.2 Add the QR dependency (`qrcode.react`, which ships ESM; `react-qr-code` was dropped because it is CommonJS only and Vite handed its module object to React as the component) to `apps/frontend/package.json` via the root catalog convention in `references/aliases-and-deps.md`
- [x] 5.3 Extend `useSignIn` with a second step: detect `twoFactorRedirect`, hold the code, the backup-code mode and `trustDevice`, and call `twoFactor.verifyTotp` or `verifyBackupCode`, with Spanish errors
- [x] 5.4 Render the code step in `sign-in-content.tsx` (numeric one-time-code input, backup-code toggle, trust-device checkbox, back to email/password)
- [x] 5.5 Add a two-factor section to the profile (`features/profile/overview`): on/off `StatusTag`, enable dialog (password → QR + secret + backup codes → verify code), disable dialog, regenerate-backup-codes dialog, and the SSO-only explanation for users without a credential account
- [x] 5.6 Add the mutation hooks to `features/profile/overview/hooks` (or extend `use-profile-mutations.ts`) following the existing `unwrapAuth` pattern
- [x] 5.7 Unit tests for any new hook or helper (for example the sign-in step state and the TOTP-code input sanitising) per `references/testing.md`; run `bun run test`, `check-types`, Biome and `tailwind:check`

## 6. Request body cap

- [x] 6.1 Set `maxRequestBodySize` to 25 MiB in `Bun.serve` in `apps/backend/src/index.ts`, as a named constant with a comment relating it to `MAX_UPLOAD_BODY_BYTES`
- [x] 6.2 Update `references/env.md` (handler plugins / body limit paragraph) with the server-wide cap

## 7. Heavy document operation limits

- [x] 7.1 Create `packages/api/src/v1/document/operation-limit.ts` with `createOperationLimiter({ maxConcurrent, maxStarts, windowMs, now })` (per-user `running` + start timestamps, `tryAcquire` returning a release function or `null`, pruning of idle entries) and the constants (2 concurrent, 30 per 60 s)
- [x] 7.2 Add the middleware (throws `errors.TOO_MANY_REQUESTS` with the Spanish message, releases in `finally`) and export `heavyDocumentProcedure = protectedProcedure.use(...)`
- [x] 7.3 Switch `upload`, `sign`, `editPages`, `merge` and `verifySignatures` in `packages/api/src/v1/document/router.ts` to `heavyDocumentProcedure`, and mention the 429 in their OpenAPI descriptions
- [x] 7.4 Check that the frontend's document mutations surface the API message on 429 (`useOrpcMutation` error path); adjust only if they swallow it (mutations already toast it; the signature check, a query, showed a fixed line and now shows the API message on `TOO_MANY_REQUESTS`)
- [x] 7.5 Unit tests: limiter (concurrency bound, window bound with the injected clock, refused calls not counted, release on failure, per-user isolation, pruning) and the procedure-level 429 through the router with the hermetic setup; run `bun run test`

## 8. Docs and validation

- [x] 8.1 Note the 2FA recovery procedure (clear `two_factor_enabled`, delete the `two_factor` row) and `DISABLE_SIGN_UP` in the README's auth/configuration section
- [x] 8.2 Run `bun run check-types`, Biome and `bun run test` for the whole repo and fix what they report (check-types clean. Biome flags only the user's unformatted migration `snapshot.json`. Tests: 406/407 in `packages/api`, plus frontend and cron; the one failure, `readPkcs12` serial-number casing, is outside this change and comes from the local Bun 1.3.14 versus the repo's 1.4.2)
