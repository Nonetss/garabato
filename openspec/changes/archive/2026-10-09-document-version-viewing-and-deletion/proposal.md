## Why

On a document's page the "Versiones" list only offers to download each version: to look at an earlier one the user has to save it and open it elsewhere, and a wrong last step (a signature with the wrong certificate or stamp, a page edit gone wrong) cannot be undone. Users need to browse any version in place and to drop the last one, with the deletion left on their trail like every other document action.

## What Changes

- Choosing a version in "Versiones" shows that version in the document page's PDF viewer instead of the current one. The selection lives in the URL (`?version=<n>`), the viewer says which version is shown and offers to go back to the current one, the hero's download and the "Validez de las firmas" panel follow the shown version, and signing and page editing (which always act on the current version) bring the viewer back to it. Viewing stays an untraced safe read; downloading stays traced.
- A new `deleteLatestVersion` procedure removes the current version of a document that has more than one version. It is a soft delete: the version row is kept (marked deleted) so the traces and signature records that point at it survive, its encrypted object is removed from storage, the previous version becomes current again and the document's page count is restored from it. It takes the version id the caller saw as current and answers CONFLICT when it is no longer current. Signed versions can be deleted; their signature record is kept.
- Version numbers are never reused: after deleting v3, the next signature or page edit stores v4.
- Every read that treats versions as the document's content (get, list, download, verify, sign, page edit, merge, thumbnails, signature counts) ignores deleted versions.
- A new trace type, "document version deleted" ("Versión eliminada"), recorded in the same transaction as the deletion, with the deleted version and its number.
- Signature records whose version was deleted stay in the document's signature history, the signature log and the trail, with their version marked "(eliminada)", and no longer count as the document's signatures (status, signature count, the page-edit lock).
- The version list gets a "Eliminar versión" action on the current version only (when there is more than one), confirmed in a dialog that warns when the version carries a signature.
- **Schema change** (the user generates and applies the migration): a nullable `deleted_at` column on `document_versions`, and the new value in `TRACE_TYPES`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `document-management`: versions can be deleted (only the latest, never the only one, soft delete, numbers never reused); the document page lets the user choose which version to view and delete the latest one.
- `activity-traces`: new "document version deleted" trace type, its label and detail, and signature entries marking a deleted version.
- `document-signing`: signature records survive the deletion of their version, are marked "versión eliminada" in the history, and only records on live versions count as the document's signatures.
- `page-editing`: the "signed documents cannot be rewritten" rule counts only signature records on live versions.
- `signature-log`: each record says whether the version its signature produced has been deleted.

## Impact

- `packages/db/src/schema/document/document.ts` (`deletedAt` on `documentVersions`) and `packages/db/src/schema/trace/trace.ts` (`document.versionDeleted`). Needs a migration generated and applied by the user before the API changes can run.
- `packages/api/src/v1/document/` (`handler.ts`, `input.ts`, `output.ts`, `router.ts`): new procedure, live-version filtering in every version read, next version number from the highest stored number, `versionDeleted` on signature record outputs.
- `packages/api/src/v1/trace/` (output and handler): the new type and the deleted mark on versions.
- `apps/frontend/src/features/documents/detail` (version list, detail content, PDF viewer state) and `documents/shared` (new mutation hook, labels); `apps/frontend/src/features/traces/overview` (label, icon, detail sentence).
- Unit tests for the new procedure, the changed reads and the frontend model helpers.
