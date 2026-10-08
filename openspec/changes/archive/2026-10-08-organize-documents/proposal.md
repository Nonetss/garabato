## Why

The document library at `/documents` is a single flat list ordered by upload date. As documents pile up there is no way to group them, find one by name or mark the ones that matter, so the user wants to organize them: put them in folders, label them with tags and work on several at once.

## What Changes

- **Folders**: each user gets a tree of nested folders. A document lives in exactly one folder or in the library root. Folders can be created, renamed, moved (never into themselves or a descendant) and deleted; deleting a folder moves its documents and subfolders to its parent and never deletes a document. Sibling folder names are unique (case-insensitive).
- **Folder icons**: folders register as an entity type in the existing entity-icon registry, so each folder can carry a Lucide icon and palette color through `EntityIconPicker`, with a plain folder icon as fallback.
- **Tags**: each user keeps a set of tags with a name and a color from the existing entity-icon palette. A document can carry any number of tags. Tags are managed (create, rename, recolor, delete) from a dialog on `/documents`; deleting a tag removes it from every document.
- **Pinned documents**: a document can be pinned; pinned documents sort first wherever they are listed and can be filtered on.
- **Document operations accept several documents**: moving to a folder, adding/removing tags, pinning/unpinning and deleting take a list of document ids, so the same procedures serve one document and a multi-selection.
- **Library listing**: `document.list` also returns each document's folder, tags and pinned state; uploads accept an optional destination folder.
- **`/documents` page**: browses the folder tree (`?carpeta=<id>` in the URL, breadcrumbs, subfolders above the documents in both views), uploads into the open folder, searches by name and filters by tag (include/exclude), signature state and pinned state using the existing `ResourceFilters` and chips. While a filter is active the results span the whole library and each document shows its folder.
- **Multi-selection**: documents can be selected in both views; a selection bar offers move, tag, pin/unpin and delete for the selection.
- **Drag and drop**: on pointer devices documents (or the current selection) and folders can be dragged onto a folder or a breadcrumb segment to move them. Every move is also reachable through a "Mover a…" dialog, so keyboard and touch users lose nothing.
- **Document detail**: `/documents/<id>` shows the document's folder path and tags, and offers moving, tagging and pinning.
- **Database schema** (to be generated and applied by the user): new folder, tag and document–tag tables, plus a folder reference and a pinned timestamp on documents.

## Capabilities

### New Capabilities
- `document-organization`: folders (tree, CRUD, move, delete semantics, folder icons), tags (CRUD, colors, assignment), pinning, bulk operations over documents, and the `/documents` browsing, filtering, selection and drag-and-drop experience.

### Modified Capabilities
- `document-management`: the list returns folder, tags and pinned state and is ordered pinned first; upload accepts a destination folder; deleting documents accepts several ids and also drops their tag assignments and pin; the "Documents pages" requirement now browses folders and shows organization data on the detail page.

## Impact

- **Database** (`packages/db/src/schema/document/`): new `document_folders`, `document_tags` and `document_tag_assignments` tables; `folder_id` and `pinned_at` columns on `document_documents`. Needs a migration the user generates and applies; nothing in the API ships before it.
- **API** (`packages/api/src/v1/`): new `document-folder` and `document-tag` features wired as `documentFolder` and `documentTag`; `document` gains `move`, `setTags`, `pin` and `deleteMany`, and changes the `list` output and the `upload` input (additive, no breaking change for existing callers). `entity-icon/targets.ts` gets its first entry, `documentFolder`.
- **Frontend** (`apps/frontend/src/features/documents/`): the overview slice grows folder browsing, filters, selection and drag and drop; the shared slice gains the move dialog and tag picker used by overview and detail; the detail slice shows folder and tags. The `entity-icons` public entry point exports the palette swatches for the tag color field.
- **No new dependencies**: drag and drop uses the native HTML5 drag events.
