## 1. Environment and configuration

- [x] 1.1 Add `CERTIFICATE_ENCRYPTION_KEY` to `packages/env/src/server.ts` as a required string that must be base64 decoding to exactly 32 bytes; verify `check-types` passes and that a 31-byte or non-base64 value fails validation in a quick `bun -e` check with `SKIP_ENV_VALIDATION` unset
- [x] 1.2 Document `CERTIFICATE_ENCRYPTION_KEY` in the root `.env.example` (security section, required, placeholder plus `openssl rand -base64 32`, warning that losing it makes stored certificates unrecoverable); verify the file lists it next to `BETTER_AUTH_SECRET`
- [x] 1.3 Generate the key in `scripts/setup-dev.sh` (`openssl rand -base64 32`, added to the replaced keys) and in `scripts/bootstrap.sh` (generated, quoted with `env_quote`, plus a backup reminder); verify with `bash -n` on both scripts and by running `setup-dev.sh --force` against a temporary copy of the repo, never the user's real `.env`
- [x] 1.4 Pass `CERTIFICATE_ENCRYPTION_KEY: ${CERTIFICATE_ENCRYPTION_KEY}` to the backend in `compose.prod.yml` (and any compose file that lists backend secrets explicitly); verify `docker compose -f compose.prod.yml config` renders it without starting anything
- [x] 1.5 Add a fixed placeholder key to `packages/api/tests/setup.ts`; verify `turbo run test --filter=@nonete/api` still passes

## 2. Database schema (stop for the user's migration)

- [x] 2.1 Add `packages/db/src/schema/certificate/{certificate.ts,index.ts}` with the `certificates` table from design.md Decision 4 (using Drizzle `bytea` or a `customType` if it is not exported) and export it from `schema/index.ts`; verify `bun run --filter @nonete/db check-types` passes
- [x] 2.2 Add `certificateRow(overrides)` and `CertificateRow` to `packages/db/testing/rows.ts` with fixed defaults; verify `check-types` passes
- [x] 2.3 Stop and hand off: tell the user the schema is ready so they can run `db:generate`, review and apply the migration. Never run any `db:*` command or touch `packages/db/src/migrations/`

## 3. PKCS#12 reading

- [x] 3.1 Add `node-forge` and `@types/node-forge` to `packages/api` (through the root catalog if the repo pins versions there) and install; verify `bun install` succeeds and the lockfile changes only for them
- [x] 3.2 Add `packages/api/tests/fixtures/certificates/generate.sh` (test CA; RSA default, RSA `-legacy`, EC P-256, key-encipherment-only, two-keys and not-a-p12 fixtures, all with password `1234` and a subject with accents and `serialNumber=IDCES-12345678Z`) and commit its output; verify the script is idempotent and the fixtures open with `openssl pkcs12 -info -noout` (legacy with `-legacy`)
- [x] 3.3 Implement `packages/api/src/v1/certificate/pkcs12.ts` per design.md Decision 1 (forge unwrap, `node:crypto` `X509Certificate` + `checkPrivateKey`, key-usage check via `forge.asn1`, typed failures); verify `tests/v1/certificate/pkcs12.test.ts` covers every fixture, the metadata of the accented subject, the `IDCES-` prefix removal, a subject without `serialNumber`, and each failure kind

## 4. Encryption at rest

- [x] 4.1 Implement `packages/api/src/v1/certificate/vault.ts` per design.md Decision 2 (KEK from `env`, per-record DEK, AES-256-GCM, AAD `certificate:<id>:<purpose>`, version byte); verify `tests/v1/certificate/vault.test.ts` covers round-trip, wrong id, wrong purpose, a flipped byte, an unknown version and a different KEK

## 5. API feature `certificate`

- [x] 5.1 Add `input.ts` and `output.ts` (shared `certificateSummary` with `status` and `passwordRemembered`, no key-material fields; `import` input with `z.file().max(100 * 1024)`, password, optional alias 1–100, `rememberPassword` default `false`); verify `check-types` passes
- [x] 5.2 Implement `handler.ts` `list` and `get` (owner filter, `deleted_at IS NULL`, newest first, status computed from `not_after` with the 30-day window); verify handler tests for both, including `NOT_FOUND` for another user's and for a deleted certificate and the three statuses under a pinned clock
- [x] 5.3 Implement `import` (parse, Spanish `BAD_REQUEST` per failure kind, expired check, duplicate check plus unique-violation mapping to `CONFLICT`, app-generated id, sealed file and optional password, alias default); verify handler tests for the happy path (written row has metadata and no plaintext bytes or password), `rememberPassword: true`, each `BAD_REQUEST`, expiry, `CONFLICT`, two users importing the same certificate, and that no error message contains the password
- [x] 5.4 Implement `rename`, `rememberPassword` (decrypt, verify, replace), `forgetPassword` and `delete` (crypto-shredding plus `deleted_at` in one update, returns `{ id, success }`); verify handler tests for each happy path and written values, wrong password on `rememberPassword` writing nothing, `NOT_FOUND` for another user's or a deleted certificate, deleting twice, and re-import after delete
- [x] 5.5 Add `router.ts` with the methods and statuses from design.md Decision 5 (English OpenAPI texts, `tags: ["Certificates"]`) and wire `certificate: certificateRouter` into `src/v1/router.ts`; verify `check-types` and Biome pass for `packages/api`

## 6. Frontend

- [x] 6.1 Search `components/ui`, `components/shared`, `src/hooks` and `src/lib` for list rows, state tags, metadata grids, confirm dialogs, empty states, file inputs and oRPC mutation helpers, and note which ones the slice reuses; verify by listing them in the task's completion note
  - Reused: `ResourceOverview`, `EntityList` + row definition (status tag, metadata cells, `RowActionsMenu` with `Hint`), `FormDialog`, `DialogFields`, `FormField`, `Input` (`type="file"`, no file-input component existed), `ConfirmDialog` + `useTargetConfirmDialog`, `useTargetDialog`, `useDialogForm`, `useOnOpen`, `useOrpcMutation`, `useResourceMutation`, `useHydratedQuery`, `HeroCount`, `Text`, `formatDate`. Nothing new was added outside the slice except three registry icons.
- [x] 6.2 Register the `certificates` surface in `lib/app-surfaces.ts` (Spanish title, label and description, key icon through `lib/icon-registry.ts`, nav plus search) and add `pages/certificates/index.astro` with `Layout.astro` and `client:only="react"`; verify `check-types` passes for `frontend`
- [x] 6.3 Build `features/certificates/overview` (`certificates-page.tsx` with only the provider boundary, `certificates-content.tsx` with the list, the empty state and the status tags using `Text` roles, a narrow `index.ts` and a domain `index.ts`); verify `check-types`, Biome and `bun run tailwind:check` pass
- [x] 6.4 Add the import dialog (`.p12`/`.pfx` file input, masked password, optional alias, remember checkbox, Spanish API error shown in the dialog, list invalidated on success, password cleared on close); verify `check-types` and Biome pass
- [x] 6.5 Add rename, remember/forget password and delete-with-confirmation actions (icon-only controls named with `Hint`, layouts with container queries); verify `check-types`, Biome and `tailwind:check` pass

## 7. Documentation and final validation

- [x] 7.1 Update the `stack` skill: `references/api/layering.md` (or `http-semantics.md`) with the file-upload convention (`z.file()` input, multipart over `/rpc`, no MIME trust, size cap) and `references/env.md` with the `CERTIFICATE_ENCRYPTION_KEY` gotcha; verify every path cited there exists
- [x] 7.2 Run `bun run check-types`, `bun run check` and `bun run test` from the root and report the results as they are; ask the user to try the `/certificates` page with a real certificate rather than probing the running app
