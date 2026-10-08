## Context

The library is one table, `document_documents` (`packages/db/src/schema/document/document.ts`), owned per user, soft-deleted with crypto-shredding. `document.list` (`packages/api/src/v1/document/handler.ts`) returns every live document of the caller in one unpaginated array, and `/documents` (`apps/frontend/src/features/documents/overview`) renders it as a thumbnail grid (`DocumentGrid`) or an `EntityList`, switched by `?vista=`. There is no grouping, search or multi-document operation.

Pieces this change reuses rather than rebuilds:

- `entityIcons` storage, the `entityIcon` API and `EntityIconPicker`/`EntityIcon`/`IconPicker`; the registry `packages/api/src/v1/entity-icon/targets.ts` is still empty.
- `ResourceFilters` + filter chips (`components/shared/resource`), including facets with include/exclude and counts and the mobile `ListActionBar`/`FilterSheet`.
- `useQueryParam`, `useResourceMutation`/`useOrpcMutation`, `useTargetDialog`/`useTargetConfirmDialog`, `FormDialog`, `RowActionsMenu`.
- `isUniqueViolation` (`packages/api/src/shared/db-errors.ts`) to turn races on unique indexes into `CONFLICT`.
- PostgreSQL 17 in both compose files.

## Goals / Non-Goals

**Goals:**
- Folders, tags and pins stored relationally, with every invariant in the specs (sibling-unique names, depth, no cycles, atomic batches) enforced on the server.
- One set of document procedures for single and bulk operations.
- The `/documents` page stays one client-side list: browsing, search, facets and counts are computed in the browser from `document.list`, `documentFolder.list` and `documentTag.list`.

**Non-Goals:**
- No server-side pagination or search of the library (see Risks).
- No sharing of folders or tags between users or organizations.
- No change to signing, versions, the signature log (`/signatures`) or the home drop zone, which keeps uploading to the library root.
- Folders are not selectable for bulk actions; tags have no hierarchy.
- No URL-synced filters: like the signature log, filters live in component state. Only the open folder (`?carpeta=`) and the view (`?vista=`) are in the URL.
- No new dependency: drag and drop uses native HTML5 drag events.

## Decisions

### Data model (the user generates and applies the migration)

In `packages/db/src/schema/document/document.ts`, next to the existing tables:

- `document_folders`: `id` uuid (`defaultRandom`), `user_id` → `user.id` `on delete cascade`, `parent_id` → `document_folders.id` `on delete restrict` (self-reference, `(): AnyPgColumn => documentFolders.id`), `name` text, `created_at`, `updated_at`. Indexes: `(user_id)`, `(parent_id)`, and a unique index on `(user_id, coalesce(parent_id, <nil uuid>), lower(name))` so two top-level folders cannot share a name either (Drizzle's index builder has no `nullsNotDistinct()` for expression indexes, so the `coalesce` plays that role).
- `document_documents` gains `folder_id` → `document_folders.id` `on delete set null` (a safety net: the handler always reparents first) with an index, and `pinned_at` timestamp, nullable.
- `document_tags`: `id`, `user_id` → `user.id` cascade, `name`, `color` text `$type<EntityIconColor>()` default `'neutral'`, timestamps; unique `(user_id, lower(name))`.
- `document_tag_assignments`: `document_id` → `document_documents.id` cascade, `tag_id` → `document_tags.id` cascade, `created_at`; primary key `(document_id, tag_id)`, index `(tag_id)`.

Row factories for the three tables go in `packages/db/testing/rows.ts`, and `documentRow` gets the two new columns.

*Why `restrict` on `parent_id`*: deleting a folder must never cascade into its subtree; the handler reparents children before the delete, and `restrict` turns any missed path into an error instead of data loss. *Why `pinned_at` instead of a boolean*: it orders pinned documents (most recent first) for free, and "keep the first pin moment" is just `coalesce(pinned_at, now())`.
*Alternative for tags*: a `text[]` column on documents. Rejected: renaming, recoloring, deleting and counting tags would rewrite every document row, and colors need a tag row anyway.

### Folder tree logic in memory, under a per-user lock

A user's folders are few (tens to hundreds), so every tree write loads all of the caller's folders once and decides with pure functions in `packages/api/src/v1/document-folder/tree.ts`: `depthOf`, `subtreeHeight`, `isSelfOrDescendant`, `freeName` (first free ` (n)` suffix, case-insensitive). These are unit-tested directly.

Tree writes (`create`, `rename`, `move`, `delete`) run in a transaction that first locks the owner's `user` row (`select … for update`), so two concurrent moves cannot build a cycle that each check alone would miss. A row lock rather than `pg_advisory_xact_lock` keeps the whole path on Drizzle's query builder, which the fake database in the unit tests understands (it has no `execute`). Sibling-name uniqueness is checked in memory for a Spanish `CONFLICT`, and `isUniqueViolation` on the insert/update covers anything that slips through.

*Alternative*: a recursive CTE per check. Rejected: harder to test with the fake database, and it still needs the lock for cycle safety.

### API surface

New features, each with `input.ts`/`output.ts`/`handler.ts`/`router.ts`, wired in `src/v1/router.ts` as `documentFolder` and `documentTag`, all on `protectedProcedure`, tag `Documents`:

| Procedure | Method | Notes |
|---|---|---|
| `documentFolder.list` | `GET` | All folders, ordered by `lower(name)`, with `documentCount` (live documents directly inside, one `group by folder_id`). |
| `documentFolder.create` | `POST` 201 | `{ name, parentId? }`. |
| `documentFolder.rename` | `PATCH` | `{ id, name }`. |
| `documentFolder.move` | `PATCH` | `{ id, parentId: uuid \| null }` (required; `null` is the root). Self/descendant → `BAD_REQUEST`; name clash or depth → `CONFLICT`. |
| `documentFolder.delete` | `DELETE` | Reparents documents (deleted ones too, so `folder_id` never dangles) and subfolders, renames clashes with `freeName`, deletes the folder's `entity_icons` row, then the folder; returns `{ id, success }`. |
| `documentTag.list` | `GET` | Ordered by `lower(name)`, with `documentCount` over live documents. |
| `documentTag.create` | `POST` 201 | `{ name, color? }`. |
| `documentTag.update` | `PATCH` | `{ id, name?, color? }`, omitted fields kept. |
| `documentTag.delete` | `DELETE` | Assignments go with the cascade. |

On the existing `document` feature:

| Procedure | Method | Notes |
|---|---|---|
| `document.upload` | (unchanged) | Multipart input gains optional `folderId`, checked before anything is stored. |
| `document.list`, `document.get` | (unchanged) | Output gains `folderId`, `tagIds` (`array_agg` subquery, empty array when none) and `pinnedAt`; list order `pinned_at desc nulls last, created_at desc`. |
| `document.move` | `PATCH` | `{ ids, folderId: uuid \| null }`. |
| `document.updateTags` | `PATCH` | `{ ids, add: uuid[], remove: uuid[] }`; zod refines "at least one" and "disjoint". Inserts with `onConflictDoNothing`, deletes the removed pairs. |
| `document.setPinned` | `PATCH` | `{ ids, pinned }`, like `cron.setEnabled`; pinning sets `coalesce(pinned_at, now())`. |
| `document.deleteMany` | `DELETE` | `{ ids }`. |

`ids` is `z.array(z.uuid()).min(1).max(100)`, deduplicated in the handler. A shared `assertOwnedActive(tx, userId, ids)` in the document handler selects the live owned ids and throws `NOT_FOUND` unless all are present; every batch runs inside one transaction, so a failure writes nothing. The existing `document.delete` and the new `deleteMany` share one `deleteDocuments(userId, ids)` path that crypto-shreds, clears `pinned_at`, deletes the tag assignments, and then removes stored objects best-effort outside the transaction, as today.

*Why `PATCH` for move/tags/pin*: each changes one attribute of existing rows and leaves the rest untouched (http-semantics: toggles and status changes are `PATCH`). *Why `deleteMany` instead of N calls*: the spec asks for all-or-nothing, and N requests from the browser cannot give that. *Why `tagIds` and not embedded tags*: renaming or recoloring a tag then touches one cache entry (`documentTag.list`), not every document.

The entity icon registry gets `documentFolder: { readable, writable }`, both returning the subset of ids that are folders of the caller (one `select id … where user_id = ? and id in (…)`), implemented in `document-folder/icon-target.ts` (which also owns the `documentFolder` entity type constant, so `targets.ts` → folder handler → `entity-icon/handler` → `targets.ts` never forms an import cycle).

### Frontend structure

`apps/frontend/src/features/documents`:

- **`shared`** (used by overview and detail):
  - `model/folder-tree.ts`: pure `buildFolderIndex(folders)` → children by parent, `pathOf(id)`, `descendantsOf(id)`, used for breadcrumbs, the move dialog and drop-target validity.
  - `hooks/use-document-folders.ts` and `hooks/use-document-tags.ts` (queries and mutations); `use-documents.ts` gains `useDocumentsMove`, `useDocumentsUpdateTags`, `useDocumentsSetPinned`, `useDocumentsDelete` with optimistic updates on `documentsListKey`, invalidating folder/tag lists (counts) and `document.get`.
  - `components/move-to-folder-dialog.tsx` (tree with the root first, disabled targets from `folder-tree`), `components/document-tags-dialog.tsx` (a dialog rather than a popover, so row menus, the selection bar and the detail page can all open it; checkboxes with indeterminate state for a set of documents from the pure `model/tag-states.ts`, and a "Crear «…»" row when the typed name is new), `components/tag-chips.tsx` (palette dot + name, three then `+N`), `components/folder-path.tsx` (breadcrumb links; optional drop handlers supplied by the overview).
- **`overview`**:
  - `model/library-filters.ts`: pure filtering (name contains, tag include-any/exclude-none, signed, pinned) and per-option counts given the other filters — unit-testable, also used for `fetchDraftTotal`.
  - `hooks/use-library-view.ts` (open folder from `?carpeta=`, filters, whether results span the library), `hooks/use-document-selection.ts` (ids, select all visible, cleared on folder or filter change and on Escape), `hooks/use-library-drag.ts` (native drag with a private MIME type `application/x-garabato-move`, so OS file drags are ignored; drop validity from `folder-tree`; enabled only under `(pointer: fine)`).
  - Components: folder cards/rows (`EntityIcon` with the folder fallback, document count, actions menu), `folder-dialog.tsx` (create/rename in `FormDialog`; on create the icon is held in `IconPicker` state and saved with `useSetEntityIcon` once the folder id exists; on rename `EntityIconPicker` edits it directly), `manage-tags-dialog.tsx`, `selection-bar.tsx`. `DocumentGrid` cards and the list definition gain the checkbox, tag chips and pin mark; in filtered mode they show the folder path.
- **`detail`**: the hero shows `FolderPath` and `TagChips`; the actions add "Mover a…", "Etiquetas" and pin.

Shared-component changes, each with its tests:

- `EntityList` gains an optional `selection` (`isSelected`, `onToggle`) that renders a leading checkbox per row; rows stay unchanged without it.
- `ResourceFilters` gains a prop to suppress its mobile `ListActionBar` while the selection bar occupies the bottom edge.
- `@/features/entity-icons` exports `IconColorSwatches` and `ICON_PALETTE` for the tag color field and chips.

Upload: `UploadDocumentDialog` takes the open `folderId` and passes it to `document.upload`.

*Why client-side browsing*: the list is already loaded whole for the grid; folders and tags add two small queries. Search across folders, facet counts and instant folder switching then cost no extra request. *Alternative*: a server `list` with `folderId`/filters. Deferred until libraries outgrow one response (see Risks).

## Risks / Trade-offs

- [The whole library is loaded on `/documents`] → Fine for a personal library of hundreds of documents; when that stops holding, `document.list` grows keyset pagination and server filters (the `list-filter-experience` UI does not change), and a `pg_trgm` index on the name if search gets slow.
- [Native drag and drop is pointer-only and has no keyboard model] → Every drag has a "Mover a…" equivalent, and drag is disabled on coarse pointers, so touch scrolling never starts a drag.
- [Selections larger than 100 documents] → The frontend sends batches of 100 in sequence; each batch is atomic, the whole selection is not. Acceptable for a manual action; the toast reports a partial failure.
- [Folder delete renames subfolders on clash] → Deterministic and reversible by renaming; the confirmation dialog states that contents move up.
- [Tag colors break the monochrome rule in `DESIGN.md`] → The user chose palette colors; they are categorical (like entity icons), never semantic, and chips stay small (dot + text). `DESIGN.md` records the exception.
- [Concurrent tree writes] → Per-user row lock plus unique indexes; non-tree writes (moving documents) need no lock because a document cannot form a cycle.

## Migration Plan

1. The user reviews the schema change, runs `bun run db:generate`, inspects the migration and applies it (the backend applies migrations on start). Existing documents get `folder_id = null` (root) and `pinned_at = null`; nothing else changes.
2. API and frontend ship together after the migration exists.
3. Rollback: revert the code; the new tables and columns are additive and ignored by the old code, and can be dropped with a follow-up migration if the feature is abandoned.
