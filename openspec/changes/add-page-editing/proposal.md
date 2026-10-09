## Why

Before signing, users routinely need to fix the document itself: a scan came out rotated, a page is blank or out of place, or the contract and its annexes arrived as separate PDFs. Today they have to leave garabato, fix the file in another tool and upload it again, losing the document's folder, tags and history. Reordering, rotating, removing pages and merging PDFs is the most requested kind of PDF tool for a signing workflow.

## What Changes

- **Edit pages:** the owner can reorder, rotate and remove pages of an unsigned document, saved as the document's next version (the earlier versions stay downloadable). The document's page count follows the new version.
- **Merge:** the owner can join 2 to 20 of their unsigned documents, in a chosen order, into a new document in a folder of their choice. The source documents stay untouched.
- **Signed documents are protected:** both operations refuse documents that carry signatures (recorded in garabato or embedded in the PDF), because rewriting the file would invalidate them.
- **Version origin:** every version records what produced it (upload, signature, page edit or merge), and the version list shows it ("original", "firmada", "páginas editadas", "unión de documentos").
- **Document page:** a "Editar páginas" editor with page thumbnails, drag-and-drop and keyboard reordering, rotate and remove controls, and a save action.
- **Documents page:** the selection bar gains "Unir en un PDF" when at least two documents are selected, opening a dialog to order them and name the result.

## Capabilities

### New Capabilities

- `page-editing`: editing the pages of a document into a new version, merging documents into a new one, the signature guard, and the editor and merge dialog in the frontend.

### Modified Capabilities

- `document-management`: versions are no longer produced only by uploads and signatures; each version records its origin, and the document page's version list shows it.
- `document-organization`: the multi-selection bar adds the "Unir en un PDF" action.

## Impact

- **API** (`packages/api`):
  - `document.editPages` and `document.merge` procedures.
  - The upload's create-and-store flow is extracted into a helper that merge reuses.
  - Version outputs gain `kind`.
- **Database** (`packages/db`): a `kind` column on `document_versions`, with existing rows backfilled (version 1 → upload, the rest → signature). The user generates and applies the migration, adding the backfill statement.
- **Frontend**:
  - The document page gets the page editor (thumbnails rendered with the existing pdf.js setup) and version labels.
  - The documents page's selection bar gets the merge dialog.
- **Dependencies**: none new; `@cantoo/pdf-lib` already rewrites and copies pages.
- **Interaction with `add-signature-validation`**: if it lands first, the signature guard reuses its extraction to detect embedded signatures; otherwise this change adds a minimal check that the validation change later replaces.
