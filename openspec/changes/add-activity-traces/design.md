## Context

Today the only audit trail is `document_signatures` (`packages/db/src/schema/document/document.ts`): one immutable row per signature with its hashes, IP and timestamp. The "Firmas" page (`apps/frontend/src/features/signatures/`, route `apps/frontend/src/pages/signatures/index.astro`) lists it through `document.signatureLog` and `document.signatureLogCertificates`, with keyset pagination (`paginateWithTotal`, `encodeKeysetCursor`) and filters by certificate, document name and date.

Every other action on certificates (`packages/api/src/v1/certificate/handler.ts`: `import`, `rename`, `rememberPassword`, `forgetPassword`, `delete`) and documents (`packages/api/src/v1/document/handler.ts`: `upload`, `merge`, `editPages`, `download`, `rename`, `move`, `delete`, `deleteMany`) leaves at best a `createdAt`/`deletedAt` or a `document_versions` row; renames, password changes, moves and downloads leave nothing. The user wants the page renamed to "Trazas" and to show all of these.

Constraints: migrations are generated and applied by the user (AGENTS.md); `GET` procedures never write (`references/api/http-semantics.md`); `clientIp` already exists as a private helper in `document/handler.ts`.

## Goals / Non-Goals

**Goals:**

- A durable, append-only per-user trail of the actions listed in the `activity-traces` spec, written atomically with each action.
- One paginated, filterable list that merges those traces with the existing signature records, so past signatures appear without a backfill.
- Replace `/signatures` with `/traces`, reusing the signature log UI (rows, filters, signature detail sheet) instead of building a second one.

**Non-Goals:**

- Tracing folders, tags, pins, signature verification, sign-ins (sessions already have their own history) or administrator actions.
- Tracing failed or refused attempts (wrong PKCS#12 password, not-found, validation errors).
- An administrator view across users; the trail is per user. The Loki-based `activity-log` (page views and API calls for admins) is untouched and unrelated.
- Backfilling traces for actions performed before the table exists (uploads and certificate imports could be reconstructed from `createdAt`, but that is a data migration the user may choose to write; see Open Questions).
- Removing `document.signatureLog` / `signatureLogCertificates`.
- A per-document or per-certificate trail inside their own pages.

## Decisions

### 1. A new append-only `trace_events` table, signatures stay where they are

New schema module `packages/db/src/schema/trace/trace.ts`, exported from `schema/index.ts`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk, default random | |
| `user_id` | text, FK `user.id` on delete cascade | |
| `type` | text, typed `TraceType` | values below |
| `occurred_at` | timestamp, not null, default now | |
| `document_id` | uuid null, FK `document_documents.id` on delete cascade | documents are soft-deleted, so the row survives |
| `certificate_id` | uuid null, FK `certificate_certificates.id` on delete cascade | likewise soft-deleted |
| `version_id` | uuid null, FK `document_versions.id` on delete cascade | |
| `ip_address` | text null | |
| `details` | jsonb null, typed `TraceDetails` | per-type snapshot |

Indexes: `(user_id, occurred_at, id)` for the keyset scan, plus `document_id` and `certificate_id`.

`TraceType`: `certificate.imported`, `certificate.renamed`, `certificate.passwordRemembered`, `certificate.passwordForgotten`, `certificate.deleted`, `document.uploaded`, `document.merged`, `document.pagesEdited`, `document.downloaded`, `document.renamed`, `document.moved`, `document.deleted`. The trail adds a 13th, synthetic type, `document.signed`, that is never stored in this table.

`TraceDetails` is a TypeScript union keyed by type (`{ from, to }` for renames; `{ from: FolderRef, to: FolderRef }` with `FolderRef = { id, name } | null` for moves; `{ sources: { id, name }[] }` for merges; `{ versionNumber }` for page edits and downloads). Names are snapshotted because folders are hard-deleted and names change; ids are kept so the UI can still link.

*Alternatives considered:* (a) deriving the trail from `createdAt`/`deletedAt`/`document_versions` with no schema change — rejected with the user: it cannot represent renames, passwords, moves or downloads, and has no IP. (b) Writing signatures into `trace_events` too — rejected: it duplicates `document_signatures`, which is the legal evidence, and would need a backfill for past signatures. (c) A Postgres `type` enum — rejected in favour of `text` + TS type, so adding a type later needs no enum migration (same pattern as `document_versions.kind`).

### 2. Write the trace inside the action's transaction via a shared helper

`packages/api/src/shared/trace.ts` exports `recordTraces(executor, userId, context, events[])` (one insert of N rows) and `TraceInput`. `executor` is `db` or a transaction `tx`, so each handler passes the same `tx` it already uses. `clientIp` moves from `document/handler.ts` to `packages/api/src/shared/client-ip.ts` and both features import it.

Handlers that do not use a transaction today (certificate `rename`, `rememberPassword`, `forgetPassword`, `delete`, `import`; document `rename`) are wrapped in `db.transaction`. Renames read the previous name inside the transaction (`select … for update` is unnecessary: the update's `returning` plus a prior select in the same transaction is enough for an audit snapshot) and skip the trace when the cleaned name is unchanged. `move` reads the current `folderId` of each document and the folder names inside its existing transaction and traces only the documents whose folder changes. `deleteDocuments` traces every id it deletes. Upload and merge trace inside the transaction that inserts the document and its first version (the shared commit path around line 687 of `document/handler.ts`); `editPages` inside its existing transaction.

*Alternative:* emitting traces after commit, best-effort — rejected: an audit trail that can silently miss actions is not one.

### 3. Explicit download as a new `POST document.exportVersion`

`document.download` (`GET`) stays a safe read: it feeds the viewer (`useDocumentFile`) and thumbnails (`useDocumentPreviewFile`), which would otherwise flood the trail. A new `POST` procedure `document.exportVersion` takes the same input, returns the same `File`, and records `document.downloaded` (with the version) after the bytes decrypt successfully, in a small transaction-free insert (nothing else is written, so atomicity is trivially the insert itself). `downloadDocumentVersion` in `features/documents/shared/hooks/use-documents.ts` switches to it; its two callers (documents overview and detail) need no change.

*Alternatives:* tracing inside the `GET` (breaks the safe-method rule and traces every view); a separate `recordDownload` call after the `GET` (two requests that can disagree).

### 4. The trail is a `UNION ALL` with keyset pagination

New feature `packages/api/src/v1/trace/` (`input.ts`, `output.ts`, `handler.ts`, `router.ts`) mounted as `trace` in `src/v1/router.ts`:

- `trace.list` (`GET`): input `{ cursor, limit, types?, excludedTypes?, certificateId?, query?, from?, before? }` (arrays of scalars fit a query string). The handler builds a subquery `UNION ALL` of (a) `trace_events` and (b) `document_signatures` projected to the same columns (`id`, `type = 'document.signed'`, `occurred_at = signed_at`, `document_id`, `certificate_id`, `version_id`, `ip_address`), each branch pre-filtered by user, type, certificate and dates so the planner uses the per-table indexes. The outer query left-joins documents and certificates for the name/alias text filter and the display fields, orders by `(occurred_at desc, id desc)` and applies the existing keyset helpers; the count runs over the same union. A branch is skipped entirely when the type filters exclude it (e.g. only `document.signed` reads just signatures). The page's signature rows are then hydrated with the full signature log fields through the existing `signatureJoin`/`toLogRecord` logic, which moves to a module both `document` and `trace` import (or `trace` reuses an exported helper from `document`'s handler-adjacent file — whichever keeps `router.ts` wiring-only).
- `trace.certificates` (`GET`): every certificate of the caller, deleted included, ordered by alias.

Output: `entries` as a zod discriminated union on `type` (common fields + `details` per type; `document.signed` adds `signature`, the existing signature log record shape), `total`, `nextCursor`.

*Alternative:* two separate lists merged client-side — rejected: pagination and totals cannot be correct across two cursors.

### 5. Frontend: rename the feature, generalize the list, keep the signature sheet

- `features/signatures` → `features/traces` (slice `overview`), `pages/signatures/index.astro` → `pages/traces/index.astro`; `pages/signatures/` is deleted (no redirect, per the user).
- `lib/app-surfaces.ts`: surface id `traces`, path `/traces`, label/title "Trazas", a new description, same nav slot; icon `iconRef("navigation", "traces")` registered in `lib/icon-registry.ts` (Lucide `History`); the surface search source follows the registry.
- `use-signature-log.ts` → `use-traces.ts` over `orpc.v1.trace.list` / `trace.certificates`; `model/filters.ts` gains the type facet (include/exclude) and keeps the day-range mapping; `definitions/` gains a trace-type definition map (label, icon, row summary renderer) per type.
- `signature-detail-sheet.tsx` is kept for `document.signed` rows; a new `trace-detail-sheet.tsx` covers the other types. Labels follow the spec and the existing `deletedAware`/`placementLabel` helpers.
- `layouts` `scrollToTop` stays on the page.

### 6. Docs

`README.md` and `apps/site` (`content/docs/{en,es}/first-run.md`, `i18n/ui.ts`, `lib/screens.ts`) describe "Trazas" at `/traces`. The screenshot files under `doc/screenshots/` keep their names until the user retakes them; `screens.ts` points its route at `/traces`.

## Risks / Trade-offs

- [The union query grows with history] → Each branch is filtered by `user_id` and range on indexed columns before the union; per-user volume is small. Revisit with a materialized approach only if a user's trail gets slow.
- [Wrapping single updates in transactions adds a round trip] → Negligible against the vault/S3 work these procedures already do.
- [API-key clients that download through `GET document.download` are not traced] → Documented in the procedure descriptions; the explicit `exportVersion` is the traced path. Open question below.
- [Breaking: `/signatures` disappears with no redirect] → Chosen by the user; bookmarks get the 404 page.
- [Trail starts empty for non-signature actions] → Signatures are complete from day one; earlier imports/uploads only appear if the user backfills (open question).
- [Details JSON drift between versions] → `TraceDetails` is typed and validated by the output zod union; new fields are additive.

## Migration Plan

1. Add the schema module; the user runs `bun run db:generate` and reviews/applies the migration (the agent never does).
2. Deploy API + frontend together: the frontend calls `trace.*` and `document.exportVersion`, which need the new table.
3. Rollback: revert the code; the `trace_events` table can stay (nothing else references it) or be dropped by the user.

## Open Questions

- Backfill: should the user's migration also insert `certificate.imported` from `certificate_certificates.created_at`, `document.uploaded`/`document.merged`/`document.pagesEdited` from `document_versions`, and `certificate.deleted`/`document.deleted` from `deleted_at`? Default in this change: no backfill.
- Should `GET document.download` called with an API key (not from the UI) also count as a download? Default: no; only `exportVersion` is traced.
