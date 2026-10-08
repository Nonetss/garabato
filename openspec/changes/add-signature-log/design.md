## Context

Signature records already hold everything the log needs (see `add-document-signing`): `document_signatures` points to the document, the produced version and the certificate, and both `document_documents` and `certificate_certificates` are soft-deleted, so a join always resolves. `packages/api/src/v1/document/handler.ts` already has the join (`signatureJoin`) and the row mapping (`toRecord`) behind `document.get` and `document.signatures`, but those return unpaginated arrays scoped to one document or one certificate.

The closest existing list page is the admin activity log (`apps/frontend/src/features/admin/logs`): `ResourceFilters` with search, select and date filters, `useHydratedInfiniteQuery` over an `infiniteOptions` query, `InfiniteScrollSentinel`, and the layout's `scrollToTop` opt-in. Keyset paging goes through `withKeysetPagination` (`@nonete/db/keyset-pagination`) and the cursor and total helpers in `#shared/pagination`.

## Goals / Non-Goals

**Goals:**
- One paginated, filterable read of all the caller's signature records, with enough certificate data for the detail panel, in a single request per page.
- Reuse the existing join, mapping, pagination and list-page building blocks; no new shared component unless one is missing.

**Non-Goals:**
- No schema, index or migration changes (see Risks for when an index would pay off).
- No change to `document.signatures`, `document.get`, the document detail history or the `/certificates` sheet.
- No URL-synced filter state; filters live in component state like the activity log.

## Decisions

### Two new procedures on the `document` feature

`document.signatureLog` (`GET`) and `document.signatureLogCertificates` (`GET`), both on `protectedProcedure`.

- *Why in `document`*: the join and `toRecord` already live there, and the records are part of the document-signing domain. A new `signature` API feature would need those helpers moved to a shared module only to be imported back; not worth it for two reads.
- *Why not extend `document.signatures`*: its input demands exactly one of `documentId`/`certificateId` and its output is a bare array consumed by two screens. Making it paginated and optional-filtered would change its contract for both consumers.
- *Why a separate certificates procedure*: `certificate.list` returns only active certificates, and the filter must offer deleted ones the caller signed with. A `selectDistinct` over the same join is cheap and keeps `certificate.list` untouched.

### Input and output shape

`signatureLog` input: `limit` (`paginationLimit(25, 100)`), `cursor` (`paginationCursor()`), and optional `certificateId`, `query` (trimmed string, 1–200), `signedFrom` and `signedBefore` (ISO datetimes). A zod `refine` rejects `signedFrom >= signedBefore` with a bad-request error. The end bound is exclusive so a whole day is `[start of day, start of next day)` without millisecond edge cases; the frontend computes both bounds in the browser's time zone with `date-fns` (`startOfDay`, `addDays`).

Output: `{ records, nextCursor, total }`, following `cron.runs`'s `{ runs, nextCursor }` shape plus the total that `paginateWithTotal` provides. Each record is the existing `signatureRecord` extended with `certificateDeleted`, `certificateTaxId`, `certificateIssuer`, `certificateSerialNumber`, `certificateFingerprint`, `certificateNotBefore` and `certificateNotAfter` — flat, like the existing record, so the per-document and per-certificate views keep their type and the log type is a superset.

*Alternative*: a lean list row plus a `signatureLog.get` for the detail. Rejected: the extra fields are seven short strings already joined, and a second round trip would make the detail panel load separately for no gain.

### Query

Build the log query from a variant of `signatureJoin` that also selects the certificate columns and `certificates.deletedAt` (extend `signatureJoin` itself if `toRecord`'s callers stay unaffected; otherwise a sibling `signatureLogJoin`). Filters, combined by `withKeysetPagination` over `(document_signatures.signed_at, document_signatures.id)`:

- `eq(documentSignatures.userId, userId)` always.
- `eq(documentSignatures.certificateId, certificateId)` after checking the certificate belongs to the caller (deleted included) with `assertFound(..., "Certificado no encontrado")`, as `document.signatures` does.
- `ilike(documents.name, likePattern(query))` from `#shared/search` — a one-table predicate, so no `union` is needed.
- `gte(signedAt, signedFrom)` and `lt(signedAt, signedBefore)`.

Fetch `limit + 1` and pass a `count()` query with the same joins and filters minus the cursor to `paginateWithTotal`; the next cursor is `encodeKeysetCursor(lastRow.signedAt, lastRow.id)` when `hasMore`.

`signatureLogCertificates` selects distinct `certificates.id, alias, commonName, deletedAt` joined from `document_signatures` where `document_signatures.user_id = userId`, ordered by alias then id.

### Frontend feature

A new `signatures` feature with a single `overview` slice (no `shared` slice: only one consumer):

- `components/signatures-page.tsx` (provider boundary) and `signatures-content.tsx` (hero with total, `ResourceFilters`, list, sentinel, empty and no-match `StateCard`s).
- `definitions/signature.definition.tsx`: the rows as an `EntityList` definition whose row opens the detail; `components/signature-detail-sheet.tsx`: a `Sheet` like `certificate-signatures-sheet.tsx`, with the facts in a `<dl>` and `CopyButton` on hashes and fingerprint.
- `hooks/use-signature-log.ts`: filter state, the query input, the infinite query and the certificate options query, modelled on `use-activity-log.ts`; the text filter goes through `useDebouncedValue`.
- `model/filters.ts`: pure helpers — filters → query input (day bounds), placement label ("Firma invisible" / "Visible en página(s) …"), deleted-name label — so they can be unit-tested without rendering.

`formatPages` moves from `features/documents/shared/model/files.ts` to `src/lib/format.ts`: it is a generic formatter with two feature consumers now, and importing it through the `documents` barrel at runtime would pull Astro-only modules into the model code and its tests. The `SignatureRecord` type is re-exported from `@/features/documents` (type-only import). The `signatures` surface goes in `app-surfaces.ts` with `nav: { primary: true }` after `certificates`, and a `signatures` entry in `navigationIcons` (`Lucide.FileSignature`). The page is `apps/frontend/src/pages/signatures/index.astro` with the same layout as `/documents` and `scrollToTop`.

## Risks / Trade-offs

- [Only `document_signatures.user_id` is indexed, so ordering by `signed_at` sorts the user's records in memory] → fine at a single user's volume; if the log grows to tens of thousands of rows per user, propose to the user a composite index on `(user_id, signed_at, id)` (a schema change the user generates).
- [`ilike '%text%'` on the document name scans the joined documents] → same volume argument; the free-text reference's trigram guidance applies if it ever matters.
- [Day bounds use the browser's time zone while the stamp shows Europe/Madrid time] → for the current single user both are the same; the spec states the browser's zone explicitly.
- [Extending `signatureJoin` could leak new fields into `document.get`/`document.signatures` outputs] → output schemas are zod objects, which strip unknown keys, and `toRecord` maps fields explicitly; tests on both procedures stay green.

## Migration Plan

None: no schema or data changes. Deploys with the next backend and frontend build; rolling back removes the page and the two procedures with no data effect.
