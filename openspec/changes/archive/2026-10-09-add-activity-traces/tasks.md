## 1. Schema (user generates the migration)

- [x] 1.1 Add `packages/db/src/schema/trace/trace.ts` with the `trace_events` table, its indexes, `TraceType`, `TraceDetails` and inferred types, and `trace/index.ts`; export it from `packages/db/src/schema/index.ts` (and register the relations if the schema uses a relations file)
- [x] 1.2 Make the fake database from `@nonete/db/testing` aware of the new table if it needs explicit registration
- [x] 1.3 STOP: ask the user to run `bun run db:generate` and apply the migration (and decide on the optional backfill from the design's Open Questions) before continuing with code that queries the table at runtime

## 2. Shared API helpers

- [x] 2.1 Move `clientIp` from `packages/api/src/v1/document/handler.ts` to `packages/api/src/shared/client-ip.ts` and import it from the document handler
- [x] 2.2 Add `packages/api/src/shared/trace.ts` with `recordTraces(executor, userId, context, events)` taking `db` or a transaction and the typed per-type `TraceInput`
- [x] 2.3 Tests: `packages/api/tests/shared/client-ip.test.ts` and `packages/api/tests/shared/trace.test.ts` (rows written, IP captured or null, details stored)
- [x] 2.4 Update `.agents/skills/stack/references/api/layering.md`'s `shared/` list with `client-ip.ts` and `trace.ts`

## 3. Trace certificate actions

- [x] 3.1 `certificate.import`: wrap the insert in a transaction and record `certificate.imported`
- [x] 3.2 `certificate.rename`: transaction reading the previous alias; record `certificate.renamed` with `{ from, to }` only when the alias changes
- [x] 3.3 `certificate.rememberPassword` / `forgetPassword`: record `certificate.passwordRemembered` / `certificate.passwordForgotten` in the same transaction as the update
- [x] 3.4 `certificate.delete`: record `certificate.deleted` in the same transaction as the crypto-shredding update
- [x] 3.5 Tests in `packages/api/tests/v1/certificate/handler.test.ts`: one trace per successful action, none on a wrong-password import, none on a no-op rename, none for not-found

## 4. Trace document actions

- [x] 4.1 Upload and merge: record `document.uploaded` / `document.merged` (with version 1 and the merge sources in order) inside the transaction that inserts the document and its version
- [x] 4.2 `editPages`: record `document.pagesEdited` with the new version inside its transaction
- [x] 4.3 `rename`: wrap in a transaction reading the previous name; record `document.renamed` only when the name changes
- [x] 4.4 `move`: inside its transaction, read each document's current folder and the folder names; record `document.moved` with origin/destination `FolderRef` for each document whose folder changes
- [x] 4.5 `deleteDocuments` (used by `delete` and `deleteMany`): record one `document.deleted` per deleted id inside its transaction
- [x] 4.6 Add `document.exportVersion` (`POST`, same input as `download`, `File` output) that returns the version and records `document.downloaded` with the version; update `download`'s OpenAPI description to say it is the untraced read used for rendering
- [x] 4.7 Tests in `packages/api/tests/v1/document/handler.test.ts` for each traced action (rows written, skipped no-op moves/renames, one trace per id on `deleteMany`, `exportVersion` returns the file and traces, `download` writes nothing)

## 5. Trail API (`trace` feature)

- [x] 5.1 Make the signature log record projection (`signatureJoin`/`toLogRecord`) reusable from outside `document/handler.ts` without changing `document.signatureLog`
- [x] 5.2 Add `packages/api/src/v1/trace/input.ts` (`list`: cursor, limit, `types`, `excludedTypes`, `certificateId`, `query`, `from`, `before` with refinements for overlap and range; `certificates`: none)
- [x] 5.3 Add `packages/api/src/v1/trace/output.ts` (entries as a discriminated union on `type`, `document.signed` carrying the signature log record; `total`; `nextCursor`; certificate options)
- [x] 5.4 Add `packages/api/src/v1/trace/handler.ts`: `list` with the `UNION ALL` of `trace_events` and `document_signatures`, per-branch filters, branch skipping by type, name/alias text filter with `likePattern`, keyset pagination and total; `certificates` over all the caller's certificates
- [x] 5.5 Add `packages/api/src/v1/trace/router.ts` (`GET` procedures with English OpenAPI summary/description, tag `Traces`) and mount it as `trace` in `packages/api/src/v1/router.ts`
- [x] 5.6 Tests in `packages/api/tests/v1/trace/handler.test.ts`: merged ordering of events and signatures, pages and total, deleted document/certificate flags, isolation between users, each filter, malformed cursor, overlapping types, inverted range, foreign certificate

## 6. Frontend

- [x] 6.1 Rename `apps/frontend/src/features/signatures` to `features/traces` and `pages/signatures/index.astro` to `pages/traces/index.astro` (delete `pages/signatures/`), updating imports and barrels
- [x] 6.2 `lib/app-surfaces.ts`: replace the `signatures` surface with `traces` (`/traces`, "Trazas", new Spanish description, same nav placement); register the `traces` navigation icon in `lib/icon-registry.ts`; update the surface search sources and any other reference to the old surface id
- [x] 6.3 Hook `use-traces.ts` over `orpc.v1.trace.list` (infinite) and `trace.certificates`, replacing `use-signature-log.ts`
- [x] 6.4 `model/filters.ts`: add the "Tipo" facet (include/exclude) and map filters to the `trace.list` input; `model/types.ts`: trace entry types from the API output
- [x] 6.5 `definitions/`: per-type label, icon and row summary (version, from/to names, folders with "Biblioteca" for root, merge count, signature placement and certificate), marking deleted documents/certificates "eliminado"
- [x] 6.6 `traces-content.tsx`: rows, hero total, empty state ("no activity yet" linking to `/documents`), no-match state with clear filters, filter panel with text, type facet, certificate and "Desde"/"Hasta"
- [x] 6.7 Keep `signature-detail-sheet.tsx` for `document.signed` rows and add `trace-detail-sheet.tsx` for the other types per the "Trace detail" requirement
- [x] 6.8 Switch `downloadDocumentVersion` in `features/documents/shared/hooks/use-documents.ts` to `orpc.v1.document.exportVersion`
- [x] 6.9 Tests: `bun test` for the filters mapping (type facet + day range) and the per-type summaries/labels

## 7. Docs

- [x] 7.1 `README.md`: replace the `/signatures` page description and route table row with "Trazas" at `/traces`
- [x] 7.2 `apps/site`: update `content/docs/{en,es}/first-run.md`, `i18n/ui.ts` and the `/signatures` route in `lib/screens.ts`; tell the user the `doc/screenshots/signatures*.webp` screenshots need retaking
- [x] 7.3 Check `.agents/skills/stack/references/` for mentions of the signatures surface and update them

## 8. Validation

- [x] 8.1 Run `check-types`, Biome, `bun run tailwind:check` and `bun run test`, and fix what they report
- [x] 8.2 `openspec validate add-activity-traces` passes
