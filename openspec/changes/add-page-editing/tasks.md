## 1. Database schema (user generates and applies the migration)

- [x] 1.1 Confirm with the user before touching the schema, then add `kind` (`text`, not null, typed `"upload" | "merge" | "signature" | "pages"`, exported as `DocumentVersionKind`) to `documentVersions` in `packages/db/src/schema/document/document.ts`, and update the table comment ("1 is the upload or the merge, each signature or page edit adds the next one"); verify `bun run --filter @nonete/db check-types`
- [x] 1.2 Add `kind` (default `"upload"`) to `documentVersionRow` in `packages/db/testing/rows.ts`; verify `check-types`
- [ ] 1.3 Stop and ask the user to run `bun run db:generate`, append `UPDATE document_versions SET kind = 'upload' WHERE number = 1;` after the column is added with default `'signature'`, and apply it; do not continue with tasks that write or read `kind` until they confirm it exists

## 2. API: version origin and create flow

- [x] 2.1 Set `kind` explicitly on every `documentVersions` insert (`upload` in upload, `signature` in sign) and add `kind` (with `.describe()`) to the version output in `output.ts` and its mapper
- [x] 2.2 Extract the upload's create-and-store flow into a module-private `createDocument(context, { name, folderId, bytes, kind })` and make `upload` use it, with no behavior change
- [x] 2.3 Update `handler.test.ts` for `kind` on upload and sign versions and confirm the upload tests still pass unchanged; then run `bun run test`

## 3. API: page operations

- [x] 3.1 Add `packages/api/src/v1/document/pages.ts` with pure helpers over `@cantoo/pdf-lib`:
  - `assertPageList(list, pageCount)`: non-empty, in range, no duplicates, rotation in {0, 90, 180, 270}, not a no-op. Throws a typed error the handler maps to `BAD_REQUEST`;
  - `rewritePages(bytes, list)`: in place, full save;
  - `mergePdfs(sources)`;
  - `hasEmbeddedSignature(bytes)`: reuse `#v1/document/validation/extract` if it exists.
- [x] 3.2 Write `packages/api/tests/v1/document/pages.test.ts` with generated PDFs whose pages carry distinguishable sizes or text:
  - reorder, rotate (added to an existing rotation) and remove;
  - catalog metadata kept;
  - merge order and page count;
  - each `assertPageList` rejection;
  - `hasEmbeddedSignature` on a garabato-signed PDF and an unsigned one.

  Then run `bun run test`
- [x] 3.3 Add `editPages` (`documentId`, `baseVersionId`, `pages: { page, rotation }[]`) and `merge` (`documentIds` 2–20, `name`, optional `folderId`) inputs and outputs (`editPages` → the new version and the document's page count; `merge` → the new document summary)
- [x] 3.4 Implement the shared `assertRewritable(document, bytes)` guard (signature record count plus `hasEmbeddedSignature`), with the Spanish conflict messages from the design
- [x] 3.5 Implement `documentHandler.editPages` with the same flow as `sign`:
  1. current-version check (conflict);
  2. guard;
  3. `rewritePages`;
  4. seal and `putObject`;
  5. one transaction inserting the `pages` version and updating `documents.page_count` and `updated_at`;
  6. unique violation → conflict.
- [x] 3.6 Implement `documentHandler.merge`:
  1. owned live documents (not found otherwise), duplicates → bad request;
  2. a pre-decryption bound on the summed source sizes;
  3. guard on each in order;
  4. decrypt the current versions;
  5. `mergePdfs`;
  6. `MAX_PDF_BYTES` check (bad request in Spanish);
  7. folder ownership;
  8. `createDocument` with `kind: "merge"` and the normalized name.
- [x] 3.7 Wire both in `router.ts` as `POST` with `successStatus: 201`, `tags: ["Documents"]` and English summaries and descriptions
- [x] 3.8 Extend `handler.test.ts`:
  - **edit:** new version and page count, no-op rejected, stale base version, signed document (record), externally signed upload (embedded), another user's document;
  - **merge:** order and sources unchanged, folder and root, too large, duplicate id, signed source named in the message, another user's document.

  Then run `bun run test`

## 4. Frontend: version labels and page editor

- [x] 4.1 Add `kind` to `DocumentVersion` in `features/documents/shared/model/types.ts`, and label versions in `version-list.tsx` from it ("original", "unión de documentos", "firmada", "páginas editadas") through a small labels map in the documents labels definitions
- [x] 4.2 Add a pure page-editor reducer in `features/documents/detail/model/page-editor.ts` (move to index, move before/after, rotate left/right, toggle remove, reset, `isDirty`, summary counts, request payload) and a `usePageEditor` hook around it
- [x] 4.3 Add `useDocumentEditPages` and `useDocumentMerge` mutations next to the existing document mutations in `features/documents/shared/hooks/use-documents.ts`, invalidating the document and the documents list
- [x] 4.4 Add the page editor component in `features/documents/detail/components/`:
  - lazily rendered pdf.js thumbnails from the cached file, rotation via CSS;
  - native drag reordering plus `IconButton` move, rotate and remove controls with `Hint`;
  - the summary line;
  - "Guardar" and "Cancelar", the error message kept in place.

  Mount "Editar páginas" on the document page, disabled with a `Hint` when the document has signature records
- [x] 4.5 Write unit tests for the page-editor reducer and the version label mapping under `apps/frontend/tests/`, then run `bun run test`

## 5. Frontend: merge dialog

- [x] 5.1 Add "Unir en un PDF" to `selection-bar.tsx`, shown only while at least two documents are selected
- [x] 5.2 Add the merge dialog in `features/documents/overview/components/`:
  - the selected documents in listed order, reorderable by drag and by move buttons;
  - the name field prefilled from the first document's name without `.pdf`;
  - creation in the open folder (root while filtering);
  - on success, clear the selection and navigate to the new document;
  - on error, the dialog stays open with the message.
- [x] 5.3 Write unit tests for any pure helper added (the order list and the default name), then run `bun run test`

## 6. Docs and validation

- [x] 6.1 Describe page editing and merging in `PRODUCT.md` and `README.md`, and the editor's visual pattern in `DESIGN.md` if it introduces a new one
- [x] 6.2 Run `check-types`, Biome (`bun run check`), `bun run tailwind:check` and `bun run test`
