## Context

A document's versions live in `document_versions` (immutable rows, unique `(document_id, number)`, sealed bytes in object storage bound to the document and `v<number>`). Three tables point at a version with `onDelete: cascade`: `trace_events.version_id`, `document_signatures.version_id`, and nothing else. Deleting a version row would therefore silently drop the downloads, page-edit traces and the signature record of that version, which is the opposite of what the user asked for ("dejando registro en trazas").

Today the API takes "the current version" as `versions.at(-1)` / the highest `number` in several places (`summaryOf`, `pickVersion`, `pickVersionById`, `currentVersions`, the `list` subquery, `signVersion` and `editPages` computing `current.number + 1`), and the frontend does the same (`document.versions.at(-1)` in `document-detail-content.tsx`). The document page renders only the current version (`useDocumentFile(id)`), and `VersionList` only offers a download button per row.

Decisions already taken with the user: soft delete with a `deleted_at` column (the user generates and applies the migration), signed versions are deletable while their signature record is kept, and version numbers are never reused.

## Goals / Non-Goals

**Goals:**

- View any live version in the document page's viewer, addressable by URL, without leaving a trace.
- Delete the current version (never the only one), restoring the previous one, with a trace in the same transaction.
- Keep every trace and signature record that names a deleted version, and show that the version is gone.

**Non-Goals:**

- Deleting versions other than the latest, or restoring a deleted version.
- Side-by-side comparison of two versions.
- Re-numbering versions or reusing numbers.
- Changing the signature log page UI beyond what the shared signature components already render.

## Decisions

### Soft delete with `document_versions.deleted_at`

Add a nullable `deletedAt: timestamp("deleted_at")` to `documentVersions`. Deleting sets it; the row, its number, size and hash stay, so every FK keeps resolving and the trail can still name "v3". The object is removed best-effort after the transaction commits, like `deleteDocuments` does (log on failure; it is unreachable through the API anyway because every read filters on `deleted_at is null`).

Alternatives: hard delete (loses traces and the signature record through the cascades); changing the FKs to `set null` (still loses which version a trace named, and needs the same migration anyway).

### Live-version filter in one place

Every query that treats versions as the document's content filters `deletedAt is null`: `versionsOf`, the `list` subquery (count and current size), the `currentVersions` / `merge` and `editPages` loaders, `versionFile`, `verifySignatures`, `signVersion`. `pickVersion` / `pickVersionById` keep working unchanged because they receive only live versions. The `documentVersions` rows that the trail and the signature records join to are **not** filtered: they read `deletedAt` to set the new `versionDeleted` / `version.deleted` flags.

### Next version number is `max(number) + 1` over all rows

`signVersion` and `editPages` today compute `current.number + 1` from the live current version. After deleting v3 that would try to insert v3 again and hit the unique index. Both read the highest stored number for the document, deleted rows included, and insert one above it. The unique index stays as it is (no partial index), which is what guarantees that a number names one version forever and keeps the vault binding `v<number>` unique per document.

### `deleteLatestVersion` procedure

- Router: `heavyDocumentProcedure` (it decrypts and parses the version that becomes current to restore the page count, and shares the per-user heavy limit), `method: "DELETE"`, default `200`.
- Input: `{ id, versionId }`, `versionId` being the version the caller saw as current (same optimistic-concurrency pattern as `baseVersionId` on `sign` / `editPages`).
- Handler, in one transaction: load the owned live document; lock the document row (`select … for update`) and load its live versions; `CONFLICT` with a Spanish message when `versionId` is not the current live version or when it is the only live one; set `deletedAt`; update `documents.pageCount` with the page count of the new current version (`pageCountOf(readVersion(...))`, read before the transaction opens and re-checked inside it against the locked current version); `recordTraces(tx, …, [{ type: "document.versionDeleted", documentId, versionId }])`. After commit, `objectStorage.deleteObject(objectKey)` best-effort.
- Output: the same shape as `get` (document summary with live versions and signature records), so the page can replace its cache in one step.

### Serializing deletion against signing and page edits

Today `sign` and `editPages` rely on the unique `(document_id, number)` index to stop two writers producing the same number; nothing locks. A deletion racing a signature could otherwise let the signature store v4 built on a v3 that was deleted in between. The commit transactions of `sign` and `editPages` take the same document-row lock (`for update`) and re-check, under it, that their `baseVersionId` is still the live current version (CONFLICT otherwise, the stored object being removed by `storeThenCommit`). The lock is held only for the short commit transaction, not for the PDF work.

### Signature counts on live versions only

`signatureCount`, `lastSignedAt` and the signing status (`documentSigningStatus`, `assertRewritable`) count only records whose version is live (join `documentVersions` and filter `deletedAt is null`). The records themselves are still returned by `get`, `signatures`, `signatureLog` and the trail, each with `versionDeleted: boolean` (signature record output) or `version.deleted` (trail `versionRef`). `signature-records.ts` already joins `documentVersions` for the number, so the flag is one more selected column.

### Trace type `document.versionDeleted`

Appended to `TRACE_TYPES` in `packages/db/src/schema/trace/trace.ts`; `type` is a plain `text` column, so this part needs no SQL. No `details`: the version number comes from the `versionId` join, which survives because the row is kept. Frontend: label "Versión eliminada", the `restore` (undo) action icon so it reads apart from "Documento eliminado", destructive tone, and the sentence "Se eliminó la versión N; la anterior vuelve a ser la actual" in `features/traces/overview` (`model/labels.ts`, `definitions/trace-icons.ts`, `model/types.ts`). Wherever a version is named (trail sentences, both detail sheets, the signature history, the certificate's signature sheet) a deleted one reads `v3 (eliminada)` through one helper, `versionNumberLabel` (`documents/shared/public.ts`).

### Viewing a version on the document page

- State: `useQueryParam("version", …)` with a small number codec (absent = current). The chosen number is resolved against the live versions: a number that is not live resolves to the current version, so a stale link or a version deleted from another tab falls back cleanly. The resolution is a pure helper in `detail/model` with its tests.
- Fetch: `useDocumentFile(document.id, shownNumber)` — already supports a version number, keeps infinite `staleTime`, and the current version keeps the same cache key it has today (no `versionNumber`) so thumbnails share it.
- `VersionList` rows become selectable through two new optional props on the shared `SoftCardListItem` (`components/shared/data-display/soft-card-list.tsx`): `onSelect` turns the title into a button whose `::after` stretches over the row (the trailing controls stay above it), and `selected` tints the row and sets `aria-current`. Rows keep their download `IconButton` and the current row gains an "Eliminar versión" `IconButton` when there is more than one version.
- Page editor safety: `usePdfDocument` now returns the `file` its `ready` pdf was parsed from, because right after the shown version changes the previous file's pdf is still `ready` for a render. The page editor mounts only when that pdf matches the current version's file, so opening it from an earlier version brings the viewer back first and the editor never seeds itself from the wrong version's page count. The deletion confirmation uses `ConfirmDialog` (`components/ui/confirm-dialog.tsx`) with the destructive variant; its description warns when the version's kind is `signature`.
- A notice above the viewer while an earlier version is shown: "Estás viendo la versión N · <origin>" with a "Ver la actual" button. The hero download and `SignatureValidation` receive the shown version; `EditPagesAction` and the signing panel keep acting on the current version, and starting either clears the `version` param first.
- Mutation: `useDocumentVersionDelete` in `documents/shared/hooks/use-documents.ts`, built on the existing mutation helpers; on success it writes the returned document into the `get` cache, invalidates the documents list, the signatures and the trail keys, and invalidates the current-version file query (`download` with no `versionNumber`) because "current" now means a different version; it then clears the `version` param.

## Risks / Trade-offs

- [The migration must be applied before the new code runs] → The handlers reference `deletedAt`; tasks put the schema change first and stop for the user to generate and apply the migration before the API work is validated against a database. Unit tests use the fake DB and do not depend on it.
- [A signature can be "undone" from the user's view while the signed file may already have been shared] → The record and trace stay, the trail shows both the signature and the deletion, and the confirmation dialog says so explicitly.
- [Best-effort object removal can leave orphaned ciphertext] → Same trade-off as document deletion: the bytes are sealed under the document key and unreachable through the API; the failure is logged.
- [Restoring the page count needs to read the previous version] → It is a heavy operation and goes through the heavy-operation limiter; the read happens before the transaction to keep the lock short.
- [Version numbers with gaps (v1, v2, v4)] → Intentional, so trail entries keep pointing at an unambiguous version; the list shows the real numbers.

## Migration Plan

1. Schema change in `packages/db/src/schema` (`deletedAt` on `documentVersions`, `document.versionDeleted` in `TRACE_TYPES`).
2. The user runs `bun run db:generate` and applies the migration. Existing rows get `deleted_at = null`, i.e. everything stays live; nothing to backfill.
3. Deploy API and frontend together.

Rollback: revert the code and keep the column. Old code does not know `deleted_at`, so versions deleted meanwhile would show up again as current with their objects gone; a rollback after deletions needs those rows handled first (the user decides how).

## Open Questions

None.
