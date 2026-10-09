## 1. Environment

- [ ] 1.1 Add `DISABLE_SIGN_UP: z.stringbool().default(false)` to `packages/env/src/server.ts` with a comment on what it closes and what stays open (admin-created accounts)
- [ ] 1.2 Document `DISABLE_SIGN_UP=false` in `.env.example` and make `scripts/bootstrap.sh` (and `scripts/setup-dev.sh` if it writes env) emit it
- [ ] 1.3 Update the env reference in the `stack` skill (`references/env.md`) if it describes the auth variables

## 2. Sign-up switch and admin seed

- [ ] 2.1 In `packages/auth/src/index.ts`, set `emailAndPassword.disableSignUp` from `env.DISABLE_SIGN_UP`
- [ ] 2.2 In `packages/auth/src/oauth.ts`, set `disableImplicitSignUp` on the OIDC provider from `env.DISABLE_SIGN_UP`; check the current `accountLinking` config and record the finding for the open question in `design.md`
- [ ] 2.3 Change `packages/db/src/seed/admin.ts` to create the admin with `auth.api.createUser({ body: { email, password, name, role: "admin" } })`, update `AuthLike`, drop the follow-up role `UPDATE`, and adapt the seed's callers and test fakes (`packages/api/tests`, `packages/db/testing`)
- [ ] 2.4 Add `signUpEnabled` to `packages/api/src/v1/auth-config/output.ts` and `handler.ts`, with a `.describe()` text and updated OpenAPI description in the router
- [ ] 2.5 Unit tests: `v1.authConfig.get` returns `signUpEnabled` for both env values, and the admin seed calls `createUser` with the admin role, skips existing admins and skips without env; run `bun run test`

## 3. Sign-up in the frontend

- [ ] 3.1 Move `useAuthConfig` from `features/auth/sign-in/hooks` to a domain-local shared slice in `features/auth` (two consumers now), and update imports
- [ ] 3.2 Hide the `/signup` link in `sign-in-content.tsx` when `signUpEnabled` is false
- [ ] 3.3 Make the sign-up page render a closed-registration state (Spanish copy, `Text` roles, link to `/login`) instead of the form when `signUpEnabled` is false
- [ ] 3.4 Run `check-types`, Biome and `bun run tailwind:check` for the frontend

## 4. Two-factor: server and schema

- [ ] 4.1 Register `twoFactor({ issuer: "Garabato" })` in `packages/auth/src/index.ts`
- [ ] 4.2 Add `twoFactorEnabled` to `user` and the `twoFactor` table (fields, defaults, FK with cascade and indexes per `design.md`) in `packages/db/src/schema/auth/auth.ts`, and export them where the other auth tables are exported
- [ ] 4.3 Cross-check the schema against `@better-auth/cli generate` output (read-only, written to the scratchpad, never into `packages/db/src/migrations/`) and fix any difference
- [ ] 4.4 Update `packages/db/testing` fixtures and rows (`rows.ts`) if they build `user` rows, so `twoFactorEnabled` is present
- [ ] 4.5 **Stop and hand off to the user:** they generate and apply the migration for `two_factor` and `user.two_factor_enabled`

## 5. Two-factor: frontend

- [ ] 5.1 Add `twoFactorClient()` to `apps/frontend/src/lib/auth-client.ts`
- [ ] 5.2 Add the QR dependency (`react-qr-code`) to `apps/frontend/package.json` via the root catalog convention in `references/aliases-and-deps.md`
- [ ] 5.3 Extend `useSignIn` with a second step: detect `twoFactorRedirect`, hold the code, the backup-code mode and `trustDevice`, and call `twoFactor.verifyTotp` or `verifyBackupCode`, with Spanish errors
- [ ] 5.4 Render the code step in `sign-in-content.tsx` (numeric one-time-code input, backup-code toggle, trust-device checkbox, back to email/password)
- [ ] 5.5 Add a two-factor section to the profile (`features/profile/overview`): on/off `StatusTag`, enable dialog (password → QR + secret + backup codes → verify code), disable dialog, regenerate-backup-codes dialog, and the SSO-only explanation for users without a credential account
- [ ] 5.6 Add the mutation hooks to `features/profile/overview/hooks` (or extend `use-profile-mutations.ts`) following the existing `unwrapAuth` pattern
- [ ] 5.7 Unit tests for any new hook or helper (for example the sign-in step state and the TOTP-code input sanitising) per `references/testing.md`; run `bun run test`, `check-types`, Biome and `tailwind:check`

## 6. Request body cap

- [ ] 6.1 Set `maxRequestBodySize` to 25 MiB in `Bun.serve` in `apps/backend/src/index.ts`, as a named constant with a comment relating it to `MAX_UPLOAD_BODY_BYTES`
- [ ] 6.2 Update `references/env.md` (handler plugins / body limit paragraph) with the server-wide cap

## 7. Heavy document operation limits

- [ ] 7.1 Create `packages/api/src/v1/document/operation-limit.ts` with `createOperationLimiter({ maxConcurrent, maxStarts, windowMs, now })` (per-user `running` + start timestamps, `tryAcquire` returning a release function or `null`, pruning of idle entries) and the constants (2 concurrent, 30 per 60 s)
- [ ] 7.2 Add the middleware (throws `errors.TOO_MANY_REQUESTS` with the Spanish message, releases in `finally`) and export `heavyDocumentProcedure = protectedProcedure.use(...)`
- [ ] 7.3 Switch `upload`, `sign`, `editPages`, `merge` and `verifySignatures` in `packages/api/src/v1/document/router.ts` to `heavyDocumentProcedure`, and mention the 429 in their OpenAPI descriptions
- [ ] 7.4 Check that the frontend's document mutations surface the API message on 429 (`useOrpcMutation` error path); adjust only if they swallow it
- [ ] 7.5 Unit tests: limiter (concurrency bound, window bound with the injected clock, refused calls not counted, release on failure, per-user isolation, pruning) and the procedure-level 429 through the router with the hermetic setup; run `bun run test`

## 8. Docs and validation

- [ ] 8.1 Note the 2FA recovery procedure (clear `two_factor_enabled`, delete the `two_factor` row) and `DISABLE_SIGN_UP` in the README's auth/configuration section
- [ ] 8.2 Run `bun run check-types`, Biome and `bun run test` for the whole repo and fix what they report
