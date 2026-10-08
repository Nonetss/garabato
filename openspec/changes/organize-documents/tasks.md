## 1. Database schema (user generates and applies the migration)

- [x] 1.1 Confirm with the user before touching the schema, then add `documentFolders` (self-referencing `parent_id` with `on delete restrict`, unique `(user_id, coalesce(parent_id, nil uuid), lower(name))`), `documentTags` (unique `(user_id, lower(name))`, `color` typed as `EntityIconColor`, default `neutral`), `documentTagAssignments` (primary key `(document_id, tag_id)`, index on `tag_id`), and `folder_id` (`on delete set null`, indexed) plus `pinned_at` on `documents` in `packages/db/src/schema/document/document.ts`, with exported row types; verify `bun run --filter @nonete/db check-types`
- [x] 1.2 Add `documentFolderRow`, `documentTagRow` and `documentTagAssignmentRow` factories to `packages/db/testing/rows.ts` and the new columns to `documentRow`; verify `check-types`
- [x] 1.3 Stop and ask the user to run `bun run db:generate` and apply the migration; do not continue with API tasks that query the new columns until they confirm it exists

## 2. API: folders

- [x] 2.1 Add `packages/api/src/v1/document-folder/tree.ts` with pure `depthOf`, `subtreeHeight`, `isSelfOrDescendant`, `freeName` and a name normalizer (trim, strip control characters); verify with `packages/api/tests/v1/document-folder/tree.test.ts` (depth of root and nested folders, cycle detection, ` (2)`/` (3)` suffixing case-insensitively)
- [x] 2.2 Add `input.ts` and `output.ts` for `list`, `create`, `rename`, `move` (`parentId` required, nullable) and `delete`, exporting `documentFolderInput`/`documentFolderOutput` and the inferred types; verify `check-types`
- [x] 2.3 Implement `documentFolderHandler` in `handler.ts`: `list` with direct live document counts; `create`, `rename`, `move` and `delete` inside a transaction under the per-user row lock, with not-found for foreign or missing folders, `BAD_REQUEST` for self/descendant moves, `CONFLICT` with Spanish messages for sibling names (in-memory check plus `isUniqueViolation`) and depth over 10, and `delete` reparenting documents and subfolders (renaming clashes with `freeName`) and removing the folder's `entity_icons` row; verify `check-types`
- [x] 2.4 Add `router.ts` (`GET` list, `POST` 201 create, `PATCH` rename/move, `DELETE` delete; `tags: ["Documents"]`, English summaries) and wire `documentFolder` in `packages/api/src/v1/router.ts`; verify `orpc.v1.documentFolder.*` type-checks on the frontend
- [x] 2.5 Register `documentFolder` in `packages/api/src/v1/entity-icon/targets.ts` with `readable`/`writable` returning the caller's folder ids; verify with a test in `packages/api/tests/v1/entity-icon/` that the owner may set an icon and another user gets `NOT_FOUND`
- [x] 2.6 Write `packages/api/tests/v1/document-folder/handler.test.ts` covering every scenario of "Folder tree", "List folders", "Rename and move folders" and "Delete a folder without deleting documents" (foreign folder, duplicate sibling, too deep on create and on move, move into descendant, move to root, contents move up, name clash suffix, icon removed, nothing written on errors); verify `bun run test` passes

## 3. API: tags

- [x] 3.1 Add `packages/api/src/v1/document-tag/{input,output}.ts` for `list`, `create` (`color` optional, palette keys), `update` (`name?`, `color?`) and `delete`; verify `check-types`
- [x] 3.2 Implement `documentTagHandler` (`list` ordered by name with live document counts, `create`/`update` with case-insensitive `CONFLICT` and `isUniqueViolation`, `update` keeping omitted fields, not-found for foreign tags, `delete` returning `{ id, success }`); verify `check-types`
- [x] 3.3 Add `router.ts` (`GET`, `POST` 201, `PATCH`, `DELETE`) and wire `documentTag` in `src/v1/router.ts`; verify `check-types`
- [x] 3.4 Write `packages/api/tests/v1/document-tag/handler.test.ts` covering every scenario of "Tags" (duplicate name on create and rename, default color, omitted fields kept, foreign tag, counts excluding deleted documents); verify `bun run test` passes

## 4. API: document changes

- [x] 4.1 Extend `documentInput.upload` with optional `folderId` and `documentOutput` summaries (`list`, `get`, `upload`, `rename`) with `folderId`, `tagIds` and `pinnedAt`; add `move`, `updateTags` (refines: at least one tag, add and remove disjoint), `setPinned` and `deleteMany` inputs/outputs with `ids` of 1–100 uuids; verify `check-types`
- [x] 4.2 Update `documentHandler.upload` to check the destination folder before storing anything, and `list`/`get` to return the new fields (tag ids aggregated, empty array when none) ordered `pinned_at desc nulls last, created_at desc`; verify the existing document handler tests still pass after adjusting their queued rows
- [x] 4.3 Add `assertOwnedActive` and implement `move`, `updateTags` (`onConflictDoNothing` adds, pair deletes) and `setPinned` (`coalesce(pinned_at, now())` when pinning, `null` when unpinning) as single transactions; verify `check-types`
- [x] 4.4 Extract a `deleteDocuments(userId, ids)` path used by `delete` and the new `deleteMany`: one transaction that crypto-shreds, clears `pinned_at` and deletes tag assignments, rolling back with `NOT_FOUND` unless every id is a live document of the caller, then best-effort object removal; verify `check-types`
- [x] 4.5 Wire `move`, `updateTags`, `setPinned` (`PATCH`) and `deleteMany` (`DELETE`) in `packages/api/src/v1/document/router.ts`, and update the `upload`, `list` and `delete` descriptions; verify `check-types`
- [x] 4.6 Extend `packages/api/tests/v1/document/handler.test.ts` with the modified `document-management` scenarios (upload into own/foreign folder, pinned first, new list fields, delete several, delete clears tags and pin) and the "Organize several documents at once" scenarios (move a selection, one foreign document spoils the batch, add and remove together, pin keeps first moment, foreign folder or tag, nothing written on errors); verify `bun run test` passes

## 5. Frontend: shared building blocks

- [x] 5.1 Add an optional `selection` (`isSelected`, `onToggle`, accessible label) to `EntityList` rendering a leading checkbox, and a prop on `ResourceFilters` that suppresses the mobile `ListActionBar`; verify rows and filters render unchanged without the new props
- [x] 5.2 Export `IconColorSwatches` and `ICON_PALETTE` from `@/features/entity-icons`; verify `check-types`
- [x] 5.3 Write the tests for 5.1 in `apps/frontend/tests/components/resource/entity-list.test.tsx` and `resource-filters.test.tsx` (checkbox shown and toggling only with `selection`, action bar hidden with the new prop); verify `bun run test` passes

## 6. Frontend: documents shared slice

- [x] 6.1 Extend `features/documents/shared/model/types.ts` with the new summary fields, folder and tag types, and add `model/folder-tree.ts` (`buildFolderIndex`, `pathOf`, `descendantsOf`, children by parent sorted by name); verify with `apps/frontend/tests/features/documents/folder-tree.test.ts`
- [x] 6.2 Add `hooks/use-document-folders.ts` and `hooks/use-document-tags.ts` (list queries; create, rename/update, move and delete mutations invalidating the folder/tag lists and, for folder delete, the documents list) and extend `use-documents.ts` with `useDocumentsMove`, `useDocumentsUpdateTags`, `useDocumentsSetPinned` and `useDocumentsDelete` (optimistic on the list, batches of 100, invalidating counts and `document.get`), and `useDocumentUpload` with `folderId`; verify `check-types`
- [x] 6.3 Add `components/tag-chips.tsx`, `components/folder-path.tsx` (links to `/documents?carpeta=<id>`, optional drop handlers), `components/move-to-folder-dialog.tsx` (root first, tree with `EntityIcon`, disabled current folder and, for folders, self and descendants) and `components/document-tags-dialog.tsx` with its pure `model/tag-states.ts` (checked/indeterminate per document set, toggled tags only, "Crear «…»" for a new name; tested in `apps/frontend/tests/features/documents/tag-states.test.ts`), all with Spanish copy and `Text` roles; export them from the slice's `index.ts`; verify `check-types` and Biome

## 7. Frontend: documents overview

- [x] 7.1 Add `overview/model/library-filters.ts` (name contains case-insensitively, tag include-any/exclude-none, signed/unsigned, pinned/not pinned, per-option counts given the other filters); verify with `apps/frontend/tests/features/documents/library-filters.test.ts` covering the "Search and filter the library" scenarios
- [x] 7.2 Add `overview/hooks/use-library-view.ts` (`?carpeta=` via `useQueryParam`, filter state, library-wide mode while a filter is active, unknown folder detection), `use-document-selection.ts` (toggle, select all visible, clear on folder/filter change and on Escape) and `use-library-drag.ts` (private MIME type, fine-pointer only, drop validity from `folder-tree`, OS file drags ignored); verify `check-types`
- [x] 7.3 Add folder cards for the grid and a folder list definition (icon via `EntityIcon` with the folder fallback, document count, actions: "Editar" for name and icon, move, delete), `folder-dialog.tsx` (create with `IconPicker` saved through `useSetEntityIcon` after create, rename with `EntityIconPicker`) and the folder delete confirmation explaining contents move to the parent; verify `check-types`
- [x] 7.4 Update `DocumentGrid` cards and `document.definition.tsx` with the selection checkbox, `TagChips`, the pinned mark, the folder path in library-wide mode, drag sources, and the "Mover a…", "Etiquetas" and "Fijar"/"Quitar de fijados" actions; verify `check-types`
- [x] 7.5 Add `manage-tags-dialog.tsx` (list with counts, create, rename, recolor with `IconColorSwatches`, delete with a confirmation naming the document count) and `selection-bar.tsx` ("N seleccionados", move, tags, pin, unpin, delete with count confirmation, clear; replaces the mobile filter bar); verify `check-types`
- [x] 7.6 Rework `documents-content.tsx`: breadcrumbs with drop targets, "Nueva carpeta" and "Gestionar etiquetas" actions, `ResourceFilters` (search, "Etiquetas", "Estado", "Fijado" facets with counts and `fetchDraftTotal`), subfolders before documents in both views, empty-folder and "Carpeta no encontrada" states, upload into the open folder via `UploadDocumentDialog`'s new `folderId`; verify `check-types`, Biome and `bun run tailwind:check`

## 8. Frontend: document detail

- [x] 8.1 Show `FolderPath` and `TagChips` in the document page hero and add "Mover a…", "Etiquetas" and pin/unpin actions reusing the shared dialog and picker; verify `check-types` and Biome

## 9. Docs and validation

- [x] 9.1 Update `PRODUCT.md` (the "Firma de documentos" capability line mentions folders, tags, pins and bulk actions), `DESIGN.md` (tag chips as a categorical color exception, folder cards, selection bar) and `README.md` if it lists document features; verify every cited path exists
- [x] 9.2 Run `bun run check-types`, `bun run check`, `bun run tailwind:check` and `bun run test` and fix any failure; verify all pass
- [x] 9.3 Run `openspec validate organize-documents --strict`; verify it reports the change as valid
