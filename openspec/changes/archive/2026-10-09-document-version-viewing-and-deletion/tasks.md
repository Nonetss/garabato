## 1. Schema (user generates and applies the migration)

- [x] 1.1 Add nullable `deletedAt: timestamp("deleted_at")` to `documentVersions` in `packages/db/src/schema/document/document.ts`, with a comment on the soft delete and why the row is kept
- [x] 1.2 Append `"document.versionDeleted"` to `TRACE_TYPES` in `packages/db/src/schema/trace/trace.ts`
- [x] 1.3 Stop and ask the user to run `bun run db:generate` and apply the migration (the agent never generates, runs or edits migrations)

## 2. API: live versions everywhere

- [x] 2.1 Filter `deletedAt is null` in every read that treats versions as document content in `packages/api/src/v1/document/handler.ts`: `versionsOf`, the `list` current-version subquery (count and size), the loaders used by `merge`, `editPages`, `sign`, `versionFile` and `verifySignatures`
- [x] 2.2 Compute the next version number in `sign` and `editPages` as the highest stored number for the document (deleted rows included) plus one
- [x] 2.3 Take the document-row lock (`for update`) in the commit transactions of `sign` and `editPages` and re-check that `baseVersionId` is still the live current version, answering CONFLICT otherwise
- [x] 2.4 Count only signature records on live versions for `signatureCount`, `lastSignedAt` and `assertRewritable`
- [x] 2.5 Add `versionDeleted` to the signature record output (`output.ts`) and select it in `signature-records.ts`, so `get`, `signatures` and `signatureLog` return it
- [x] 2.6 Update the `.describe()` / OpenAPI `description` texts of `get`, `list`, `download`, `signatures` and `signatureLog` to say they work on live versions and flag deleted ones

## 3. API: `deleteLatestVersion`

- [x] 3.1 Add `documentInput.deleteLatestVersion` (`id`, `versionId` described as the version the caller saw as current) and its output (same shape as `get`)
- [x] 3.2 Implement `documentHandler.deleteLatestVersion`: load the owned live document, read the page count of the version that becomes current, then in one transaction lock the document row, CONFLICT (Spanish messages) when `versionId` is not the live current version or is the only live one, set `deletedAt`, restore `documents.pageCount`, record the `document.versionDeleted` trace; after commit remove the object best-effort and log failures
- [x] 3.3 Wire it in `router.ts` with `heavyDocumentProcedure`, `method: "DELETE"`, summary and description in English
- [x] 3.4 Unit tests in `packages/api/tests/v1/document/`: deleting a signed and a page-edit version (current version, page count, kept signature record, trace written), only version → CONFLICT, stale `versionId` → CONFLICT, another user's document → NOT_FOUND, no trace on refusal, object removal failure does not fail the call, next signature after a deletion gets `max + 1`, deleted version is NOT_FOUND on download, counts ignore records on deleted versions, editing pages allowed after undoing the only signature

## 4. API: trail

- [x] 4.1 Add `deleted` to the trail `versionRef` in `packages/api/src/v1/trace/output.ts` and select `documentVersions.deletedAt` in the trail query in `handler.ts`
- [x] 4.2 Accept `document.versionDeleted` in the trail type filters (it comes from `TRACE_TYPES`; check the output enum and any hand-listed types)
- [x] 4.3 Unit tests in `packages/api/tests/v1/trace/`: a version-deleted entry with its version, and a signature entry whose version is flagged deleted

## 5. Frontend: shared document hooks and labels

- [x] 5.1 Add `useDocumentVersionDelete` in `apps/frontend/src/features/documents/shared/hooks/use-documents.ts`, reusing the existing mutation helpers: set the `get` cache from the response, invalidate the list, signatures, trail and the current-version file query; Spanish success and error toasts
- [x] 5.2 Export it and any new types (`versionDeleted` on signature records) from the shared slice's `index.ts`

## 6. Frontend: viewing a version

- [x] 6.1 Add a pure helper in `features/documents/detail/model/` that resolves the `?version=` value against the live versions (absent, unknown or deleted → current) and a number codec for `useQueryParam`; tests in `apps/frontend/tests/features/documents/`
- [x] 6.2 In `document-detail-content.tsx`, keep the shown version in `?version=` and fetch it with `useDocumentFile(document.id, shownNumber)` (no number for the current version, so its cache key stays shared with thumbnails)
- [x] 6.3 Show a notice above the viewer while an earlier version is shown ("Estás viendo la versión N · <origen>") with a "Ver la actual" button; use `Text` roles and container queries per the stack conventions
- [x] 6.4 Make the hero download and `SignatureValidation` follow the shown version; clear `?version=` when starting to sign or to edit pages
- [x] 6.5 Make `VersionList` rows selectable (whole row as the control, `aria-current` on the shown one), keeping the download `IconButton`

## 7. Frontend: deleting the latest version

- [x] 7.1 Add an "Eliminar versión" `IconButton` (with `Hint`) on the current version's row in `VersionList`, only when there is more than one version
- [x] 7.2 Confirm with `ConfirmDialog` (destructive): name the version and the one that becomes current, and warn for signature versions that the signed file is deleted but the signature record and its trace are kept; keep the dialog open and show the API's Spanish error on failure
- [x] 7.3 After success, clear `?version=` and let the page show the new current version, page count and signatures without reloading

## 8. Frontend: signatures and traces

- [x] 8.1 Mark records with `versionDeleted` as "versión eliminada" in `signature-history.tsx` (and wherever the shared signature row renders the version)
- [x] 8.2 Add the "Versión eliminada" label, icon and sentence ("Se eliminó la versión N") for `document.versionDeleted` in `features/traces/overview` (`model/types.ts`, `model/labels.ts`, `definitions/trace-icons.ts`)
- [x] 8.3 Mark a deleted version "eliminada" in the trail row sentence and the trace detail panel
- [x] 8.4 Extend `apps/frontend/tests/features/traces/labels.test.ts` for the new type and the deleted-version mark

## 9. Validation

- [x] 9.1 `bun run check-types`, Biome, `bun run tailwind:check` and `bun run test` pass
- [x] 9.2 Ask the user to try it in the app (view v1, go back, delete the signed latest version, check `/traces`); no runtime probing by the agent
