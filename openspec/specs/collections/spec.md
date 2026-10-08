# Collections

## Purpose

Lets users save resources into a built-in favorites collection and custom collections, through a validated collection API, reusable favorite/save buttons and collection pages.

## Requirements

### Requirement: Collection storage

The database SHALL store user-owned lists of resources in a `collections` table with `id` (uuid primary key), `owner_id` (text, references the user, `ON DELETE CASCADE`), `kind` (`favorites` or `custom`), `name` (nullable text), `description` (nullable text), `created_at` and `updated_at` (refreshed on every update). A partial unique index on `owner_id` where `kind = 'favorites'` SHALL guarantee at most one favorites collection per user, while custom collections SHALL be unlimited.

Saved resources SHALL be stored in a `collection_items` table with `id` (uuid primary key), `collection_id` (references `collections`, `ON DELETE CASCADE`), `entity_type` (text), `entity_id` (text, so both uuid-backed records and Better Auth string ids fit), `metadata` (nullable jsonb display snapshot with optional `title`, `description`, `href`, `image` and any extra keys) and `created_at`. A unique index on `(collection_id, entity_type, entity_id)` SHALL keep each resource at most once per collection. The reference to the resource SHALL be polymorphic: there SHALL be no foreign key to the target table, and the API SHALL NOT check that the referenced resource exists.

#### Scenario: One favorites collection per user

- **WHEN** two concurrent requests try to create the favorites collection of the same user
- **THEN** only one `collections` row with `kind = 'favorites'` SHALL exist for that user

#### Scenario: Deleting a user removes their collections

- **WHEN** a user is deleted
- **THEN** their collections and every item in them SHALL be deleted by cascade

#### Scenario: A resource is saved once per collection

- **WHEN** the same `(entityType, entityId)` is added twice to one collection
- **THEN** a single `collection_items` row SHALL exist for it

### Requirement: Collection API feature

The API SHALL expose a `collection` feature under `packages/api/src/v1/collection/` (input, output, handler, router), mounted as `collection` in the v1 router and reachable as `orpc.v1.collection.<method>()` and under the `Collections` OpenAPI tag. Every procedure SHALL use `protectedProcedure`, so a request without a signed-in user SHALL fail with `UNAUTHORIZED`. Every procedure SHALL act only on collections whose `owner_id` is the caller: there SHALL be no way to read or change another user's collections or items, including for administrators.

#### Scenario: Unauthenticated call

- **WHEN** any `collection` procedure is called without a session or API key
- **THEN** it SHALL fail with `UNAUTHORIZED`

#### Scenario: Another user's collection

- **WHEN** a user calls `update`, `delete`, `listItems`, `addItem` or `removeItem` with the id of a collection owned by someone else, or of a collection that does not exist
- **THEN** it SHALL fail with `NOT_FOUND` and the message "Colección no encontrada", without revealing whether the collection exists

### Requirement: Collection input validation

Resource references SHALL be validated as `entityType` matching `^[a-z][a-z0-9-]*$` (trimmed, 1–64 characters) and `entityId` (trimmed, 1–255 characters). Collection ids SHALL be uuids. A custom collection `name` SHALL be trimmed and 1–120 characters ("El nombre de la colección es obligatorio" / "El nombre de la colección no puede superar 120 caracteres"). A `description` SHALL be trimmed, at most 500 characters ("La descripción no puede superar 500 caracteres"), and nullable and optional. Item `metadata` SHALL be optional and SHALL accept `title` (1–240), `description` (up to 1000), `href` (up to 2000) and `image` (up to 2000), all trimmed, and SHALL keep any additional keys.

#### Scenario: Invalid entity type

- **WHEN** `addFavorite` is called with `entityType: "Cron Job"`
- **THEN** input validation SHALL reject the request and nothing SHALL be stored

#### Scenario: Name too long

- **WHEN** `create` is called with a 121-character name
- **THEN** input validation SHALL reject it with the Spanish length message

### Requirement: Custom collection CRUD

The API SHALL provide:

- `list` (GET): every collection owned by the caller, favorites included, as `{ id, kind, name, description, createdAt, updatedAt }` ordered by `updatedAt` descending.
- `create` (POST, `201`): creates a `custom` collection with `name` and optional `description` (an empty description is stored as `null`) and returns it.
- `update` (PATCH): renames a custom collection; an omitted `description` SHALL keep the current one and an empty or `null` one SHALL clear it.
- `delete` (DELETE): deletes a custom collection, its items (by cascade) and its `entity_icons` row in one transaction, returning `{ id, success: true }`.

`update` and `delete` on the favorites collection SHALL fail with `CONFLICT` and the message "La colección de favoritos no se puede modificar así".

#### Scenario: Creating a collection

- **WHEN** a user calls `collection.create` with `{ name: "Lecturas pendientes" }`
- **THEN** a `custom` collection owned by the user SHALL be created and returned with `description: null`

#### Scenario: Keeping the description on rename

- **WHEN** a user calls `collection.update` with a new `name` and no `description`
- **THEN** the name SHALL change and the existing description SHALL be kept

#### Scenario: Favorites cannot be renamed or deleted

- **WHEN** a user calls `collection.update` or `collection.delete` with the id of their favorites collection
- **THEN** it SHALL fail with `CONFLICT`

### Requirement: Collection items

The API SHALL provide:

- `listItems` (GET): items of one of the caller's collections, newest first, as `{ id, collectionId, entityType, entityId, metadata, createdAt }`.
- `addItem` (PUT): adds a resource, with optional metadata, to one of the caller's collections (custom or favorites). It SHALL be idempotent: if the resource is already in the collection, the existing item SHALL be returned unchanged with `created: false`; a new item SHALL be returned with `created: true`.
- `removeItem` (DELETE): removes a resource from one of the caller's collections and SHALL succeed whether or not it was present.
- `updateItem` (PUT): replaces the whole `metadata` of an item that belongs to one of the caller's collections; omitted metadata SHALL clear it. An item outside the caller's collections SHALL fail with `NOT_FOUND` ("Recurso guardado no encontrado").
- `itemCollections` (GET): the caller's collections that contain a given `(entityType, entityId)`, ordered by `updatedAt` descending.

#### Scenario: Adding an item twice

- **WHEN** a user calls `addItem` twice with the same collection and resource
- **THEN** the first call SHALL return `created: true`, the second `created: false`, and the stored metadata SHALL be the one from the first call

#### Scenario: Removing an absent item

- **WHEN** a user calls `removeItem` for a resource that is not in the collection
- **THEN** it SHALL return `success: true`

#### Scenario: Memberships of a resource

- **WHEN** a cron job is saved in two of the user's collections and `itemCollections` is called for it
- **THEN** exactly those two collections SHALL be returned

### Requirement: Favorites

The favorites collection SHALL be a built-in collection of kind `favorites`, created lazily with the name "Favoritos" the first time the user adds a favorite. The API SHALL provide:

- `listFavorites` (GET): items of the caller's favorites collection, newest first; an empty list when the collection does not exist yet.
- `addFavorite` (PUT): adds a resource to favorites, creating the collection if needed; idempotent with the same `created` flag as `addItem`.
- `removeFavorite` (DELETE): removes a resource from favorites and SHALL succeed even when the favorites collection or the item does not exist.
- `favoriteStatuses` (`QUERY`): for 1 to 100 resources, returns each one with `favorited: true | false`, in request order.

#### Scenario: First favorite creates the collection

- **WHEN** a user with no favorites collection calls `addFavorite`
- **THEN** a `favorites` collection named "Favoritos" SHALL be created for them and the resource SHALL be added to it

#### Scenario: Status batch without favorites

- **WHEN** a user who never favorited anything calls `favoriteStatuses` with three resources
- **THEN** all three SHALL be returned with `favorited: false`

#### Scenario: Batch limit

- **WHEN** `favoriteStatuses` is called with more than 100 resources
- **THEN** input validation SHALL reject the request

### Requirement: Favorite and save buttons

The `collections` frontend feature SHALL expose, through `@/features/collections/favorites` and `@/features/collections/save`, reusable buttons that any resource can render with an entity ref `{ entityType, entityId, metadata? }`:

- `FavoriteButton`: a star toggle that adds or removes the resource from favorites, updating optimistically and reverting on error. Its accessible name SHALL be "Añadir a <label>" (default label "Favoritos") or "Quitar de favoritos", its visible text "Favoritos" or "En favoritos" unless `compact` (icon-only with a tooltip). It SHALL accept a `favorite` value from a batched `useFavoriteStatuses` call to skip its own status query, and SHALL be disabled while a change or its own status is pending.
- `CollectionButton`: a "Guardar" trigger that opens a popover titled "Guardar en una colección" listing every collection of the user with a checkbox reflecting membership; checking or unchecking SHALL call `addItem` or `removeItem`. The popover SHALL include a "Nueva colección" field (max 120 characters) that creates a custom collection and saves the resource into it. The trigger SHALL look active when the resource is in at least one collection.

Both buttons SHALL stop click and key events from reaching an enclosing clickable card or row. `useFavoriteStatuses` SHALL split more than 100 resources into parallel requests of 100. Mutations SHALL show Spanish success and error toasts and SHALL invalidate the affected lists, items, memberships and statuses. Cron jobs SHALL use both buttons, on their overview rows (compact) and their detail page, with `entityType: "cron-job"` and metadata `title`, `description` and `href: /crons/<id>`.

#### Scenario: Favoriting from a list row

- **WHEN** a user presses the compact star on a cron job row
- **THEN** the star SHALL fill immediately, `addFavorite` SHALL be called with the cron job's entity ref and metadata, and the toast "Añadido a favoritos" SHALL be shown

#### Scenario: Creating a collection while saving

- **WHEN** a user types "Revisar" in the save popover and submits
- **THEN** a custom collection named "Revisar" SHALL be created and the resource SHALL be added to it

#### Scenario: Clicking inside a card

- **WHEN** a `FavoriteButton` or `CollectionButton` rendered inside a navigable card is activated
- **THEN** the card SHALL NOT navigate

### Requirement: Collection pages

The frontend SHALL provide these pages under the `WithSidebar` layout, all requiring a session like every non-public page and opting into the scroll-to-top control:

- `/collections`: the section overview of the collections surfaces.
- `/collections/favorites`: the user's favorites as a saved-resource list, each with a `FavoriteButton` to unfavorite; empty state "Todavía no tienes favoritos".
- `/collections/custom`: a responsive grid of the user's custom collections (favorites excluded) with a count, a "Nueva colección" action, loading, error-with-retry and empty states. Each card SHALL show the collection's icon, name ("Colección sin nombre" when null), description ("Sin descripción" when null) and last update date, link to its detail page and offer "Editar" and "Eliminar" in its actions menu.
- `/collections/custom/[id]`: the detail of one custom collection with a back link to "Colecciones", its icon, name and description ("Recursos guardados en esta colección privada." when null), "Editar" and delete actions, and its items as a saved-resource list where each item can be removed ("Quitar de esta colección").

Create and edit SHALL use one form dialog ("Nueva colección" / "Editar colección") with name (required, max 120) and optional description (max 500). Deleting SHALL ask for confirmation, warning that the collection's saved resources will also be removed; deleting from the detail page SHALL navigate to `/collections/custom`.

#### Scenario: Unknown or favorites id on the detail page

- **WHEN** a user opens `/collections/custom/<id>` with an id that is not one of their custom collections (including their favorites collection)
- **THEN** the page SHALL show "Colección no encontrada"

#### Scenario: Deleting a collection from its detail page

- **WHEN** a user confirms "Eliminar colección" on a collection detail page
- **THEN** the collection SHALL be deleted and the user SHALL be taken to `/collections/custom`

#### Scenario: Empty custom collections

- **WHEN** a user without custom collections opens `/collections/custom`
- **THEN** the page SHALL show "Todavía no tienes colecciones personalizadas" with a "Nueva colección" action

### Requirement: Saved resource list

Favorites and collection detail pages SHALL render items with a shared saved-resource list. Each item SHALL show its metadata image (or a bookmark placeholder), its title (metadata `title`, else the humanized `entityType`), its description when present and "Guardado <date>", and SHALL link to metadata `href` when present. Each item SHALL offer "Editar información", a dialog that edits `title`, `description`, `href` and `image` and saves them through `updateItem`, dropping empty fields. An empty list SHALL show the page's empty state.

#### Scenario: Item without metadata

- **WHEN** a saved item with `entityType: "cron-job"` has no metadata
- **THEN** it SHALL be titled "Cron Job" and SHALL NOT be a link

#### Scenario: Editing an item's information

- **WHEN** a user changes an item's title in "Editar información" and saves
- **THEN** `updateItem` SHALL be called with the new metadata and the list SHALL show the new title
