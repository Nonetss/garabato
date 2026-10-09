## Context

See `proposal.md` for the motivation. The relevant current state:

- `documentHandler.upload` creates a document in one flow:
  1. generate the id;
  2. create a data key and seal v1 bound to `document:<id>`/`v1`;
  3. `putObject`;
  4. insert the document and the version in one transaction (`storeThenCommit`).

  `documentHandler.sign` adds versions with `baseVersionId` optimistic concurrency, guarded by the unique `(document_id, number)` index.
- `document_versions` has no origin column. The frontend's `version-list.tsx` labels v1 "original" and every other version "firmada".
- `documents.page_count` is set at upload and never changes today.
- `@cantoo/pdf-lib` (already a dependency) can load, reorder, rotate and remove pages in place and copy pages between documents.
- The frontend renders PDFs with pdf.js:
  - `pdf-viewer.tsx` on the document page;
  - `document-thumbnail.tsx` renders first-page thumbnails in the library;
  - `useDocumentFile` fetches and caches the current version's bytes.
- The library's drag-and-drop (`use-library-drag.ts`) is native HTML5 drag, with no drag library in the frontend.
- Migrations are the user's job: this design proposes the schema, the user generates and applies the migration.

## Goals / Non-Goals

**Goals:**
- Fix a document's pages before signing without leaving garabato or losing its folder, tags and history.
- Never break a signature: rewriting is impossible on signed documents.
- Reuse the encrypted create-and-store flow instead of duplicating it.

**Non-Goals:**
- Editing signed documents by producing an unsigned copy (a possible follow-up: "Crear copia sin firmas").
- Splitting a document into several, extracting pages to a new document, or inserting pages from another document into an existing one (merge covers the common case).
- Page content editing (annotations, text, redaction), compression, OCR.
- Preserving interactive forms across a merge (see Risks).
- Server-side thumbnail rendering.

## Decisions

### 1. Version origin: a `kind` column

- `document_versions` gains `kind text not null`, typed in Drizzle as `"upload" | "merge" | "signature" | "pages"`.
- The generated migration adds it with a temporary default `'signature'`. The user appends `UPDATE document_versions SET kind = 'upload' WHERE number = 1;` before dropping the default, so every existing row gets its true origin.
- Inserts always set it explicitly: upload `upload`, merge `merge`, sign `signature`, edit `pages`.
- The version output adds `kind`.

Alternative considered: derive the origin from signature records (a version with a record is "signature", v1 is "upload", the rest "pages"). It is fragile, costs a join on every read, and cannot tell a merged v1 apart. Rejected.

### 2. Editing in place with `@cantoo/pdf-lib`

`editPages`:
1. loads the current version;
2. validates the list (non-empty, indices in range, no duplicates, rotation in {0, 90, 180, 270}, not identical to the identity list without rotations);
3. rebuilds the page order in the same `PDFDocument`: remove every page, then insert the kept `PDFPage` objects in the requested order, setting `setRotation(degrees((current + delta) % 360))`;
4. saves with a full rewrite (`useObjectStreams: false` to match the upload's compatibility).

The new version and the updated `documents.page_count` / `updated_at` are written in one transaction after `putObject`, exactly like `sign`. A unique-index race maps to the same conflict message.

Editing in place keeps the catalog (metadata, outlines, viewer preferences, embedded files) that copying into a new document would drop. Outline entries pointing at removed pages become dead links, which viewers tolerate.

Alternative considered: an incremental update that only rewrites the `/Pages` tree. Smaller files, but no benefit on unsigned documents, and more fragile. Rejected.

### 3. Merge reuses the create flow

- The upload's create-and-store code is extracted into a module-private `createDocument(context, { name, folderId, bytes, kind })` in `handler.ts` (or `#v1/document/create` if `handler.ts` grows too much). `upload` and `merge` both call it.
- `merge`:
  1. loads every named document with the owned-and-live query;
  2. answers not found if any is missing, and rejects duplicates with bad-request;
  3. runs the signature guard on each, in order;
  4. decrypts the current versions;
  5. copies their pages (`copyPages`) into a new `PDFDocument` in the requested order;
  6. checks the result against `MAX_PDF_BYTES`;
  7. calls `createDocument` with `kind: "merge"`.
- The name goes through the existing `documentName` normalizer, and the folder through `assertOwnedFolder`.
- The procedure is a `POST` with `successStatus: 201` (it exists to create). `editPages` is a `POST` with `201` like `sign`, since it creates a version.

### 4. The signature guard

`assertRewritable(document, bytes)` throws `errors.CONFLICT` when either:
- the document has signature records (a count on `document_signatures`); or
- the current version has an AcroForm field with `/FT /Sig` and a `/V` dictionary.

The embedded check uses `#v1/document/validation/extract` when `add-signature-validation` has landed. Otherwise it uses a minimal field scan in `#v1/document/pages`, which the validation change replaces.

The messages are in Spanish:
- edit: "Este documento tiene firmas: editar sus páginas las invalidaría";
- merge: "«<nombre>» tiene firmas: unirlo las invalidaría".

### 5. Frontend: page editor

**Placement:**
- An "Editar páginas" action on the document page header opens a large `Sheet` (full height) or `Dialog` sized like the signing panel, inside `features/documents/detail`.
- The action is disabled, with a `Hint`, when the document has signature records. Embedded external signatures are caught by the API's conflict error, which the editor shows. If `add-signature-validation` has landed, its result also disables the action.

**Editor state:**
- `usePageEditor(pageCount)` holds an ordered array of `{ source, rotation, removed }` and exposes move, rotate, toggle-remove, reset and the request payload.
- It is pure enough to unit test as a reducer in `model/`.

**Thumbnails:**
- Rendered with the existing pdf.js loader from the bytes `useDocumentFile` already caches, one canvas per page at thumbnail scale.
- Rendered lazily as tiles scroll into view (`IntersectionObserver`), so a 200-page document does not render everything up front.
- Rotation is applied with a CSS transform, so rotating never re-renders.

**Reordering:**
- Native HTML5 drag between tiles, matching the library's approach, with no new dependency.
- Each tile also has "Mover antes" / "Mover después" icon buttons (`IconButton` with `Hint`) for keyboard and touch users.

**Saving:**
- `useDocumentEditPages` mutation via `useOrpcMutation` invalidates the document query.
- On success the page shows the new version, the viewer reloads the file, and the editor closes.
- On error the editor stays open with the message.

### 6. Frontend: merge dialog

- The selection bar in `features/documents/overview` gets "Unir en un PDF" while `selection.count >= 2`.
- The dialog lists the selected documents in listed order, reorderable by drag or by move buttons, with a name field prefilled with the first document's name without `.pdf`.
- On success it clears the selection, invalidates the documents list and navigates to `/documents/<new id>`.
- The folder is the open folder, or the root while filters are active, as the spec states.

## Risks / Trade-offs

- **[Interactive forms in merged documents]** `copyPages` does not merge AcroForms: field widgets survive as static appearances but stop being fillable. → Documented in the dialog's helper text only if it becomes a real complaint; merging forms properly is out of scope.
- **[Large documents in the editor]** → Lazy thumbnail rendering and CSS rotation keep it responsive; the 20 MiB cap bounds the worst case.
- **[Memory for a 20-document merge]** → All sources are decrypted in memory, bounded by 20 × 20 MiB in theory. The result cap rejects absurd merges early: the handler sums the source sizes first and rejects when they exceed a generous bound (e.g. 60 MiB) before decrypting.
- **[Backfill forgotten in the migration]** → Every existing version would read as `signature`, so v1 would show "firmada". The task list asks the user explicitly to add the `UPDATE` and to check it.
- **[Page count drift]** → `documents.page_count` is updated in the same transaction as the new version, so the list and the current version never disagree.

## Migration Plan

1. The user generates the migration for `document_versions.kind`, adds the backfill `UPDATE` for version 1, and applies it.
2. Deploy the API, then the frontend (the API ignores nothing new from old clients; the old frontend ignores `kind`).

Rollback: the column can stay; the old code never reads it.

## Open Questions

- Should merging also be offered from the document page ("Añadir otro documento al final")? The selection-bar entry covers the flow for now.
