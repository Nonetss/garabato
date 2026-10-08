# Entity Icons

## Purpose

Lets registered entity types carry a user-chosen Lucide icon and color, through polymorphic storage, an entity icon API, a generated icon catalog, a fixed color palette and a reusable icon picker, with collections as the first consumer.

## Requirements

### Requirement: Polymorphic entity icon storage

The database SHALL store entity icons in an `entity_icons` table with `id` (uuid primary key), `entity_type` (text, not null), `entity_id` (text, not null), `icon` (text, not null — a Lucide icon name in kebab-case), `color` (text, not null, default `'orange'` — a palette key), `created_by` (text, references the user, `ON DELETE SET NULL`), `created_at` and `updated_at`. A unique index on `(entity_type, entity_id)` SHALL guarantee at most one icon per entity. The table SHALL NOT carry a foreign key to any target table, and target tables (such as `collections`) SHALL NOT carry an icon column. `entity_id` SHALL be text so that both uuid-backed records and Better Auth string ids can be referenced.

#### Scenario: One icon per entity

- **WHEN** an icon is stored for an entity that already has one
- **THEN** the existing row SHALL be updated in place and no second row for that `(entity_type, entity_id)` SHALL exist

#### Scenario: Target tables carry no icon column

- **WHEN** the `@nonete/db` schema is inspected
- **THEN** the `collections` table SHALL have no icon or color column, and icons SHALL live only in `entity_icons`

### Requirement: Icon-capable entity types are registered server-side

`@nonete/api` SHALL keep a registry of the entity types that can carry an icon (`packages/api/src/v1/entity-icon/targets.ts`). Each entry SHALL define how to decide, for the calling user and a batch of entity ids of that type, which of those entities the caller may read and which the caller may modify. Every `entityIcon` procedure SHALL consult this registry. A request naming an `entityType` that is not registered SHALL fail with `BAD_REQUEST`. `collection` SHALL be registered, and only custom collections owned by the caller SHALL be readable or writable; the built-in favorites collection SHALL never carry an icon. Registering a new entity type SHALL require only a new registry entry, with no change to the table, the procedures or the frontend components.

#### Scenario: Unregistered entity type

- **WHEN** any `entityIcon` procedure is called with an `entityType` that is not in the registry
- **THEN** it SHALL fail with `BAD_REQUEST` and SHALL NOT read or write `entity_icons`

#### Scenario: Owner sets a collection icon

- **WHEN** the owner of a custom collection calls `entityIcon.set` for `{ entityType: "collection", entityId: <its id> }`
- **THEN** the icon SHALL be stored and returned

#### Scenario: Another user targets a collection

- **WHEN** a signed-in user calls `entityIcon.set` or `entityIcon.clear` for a collection they do not own, for their favorites collection, or for one that does not exist
- **THEN** the call SHALL fail with `NOT_FOUND` and a Spanish message, without revealing whether the collection exists

### Requirement: Entity icon API

The API SHALL expose an `entityIcon` feature under `packages/api/src/v1/entity-icon/` (input, output, handler, router), wired as `entityIcon` in the v1 router and reachable as `orpc.v1.entityIcon.<method>()`. Every procedure SHALL require a signed-in user (`protectedProcedure`). It SHALL provide:

- `getMany`: input `{ entities: { entityType, entityId }[] }` (1 to 100 entries); output the icons (`entityType`, `entityId`, `icon`, `color`) of those entities that have one and that the caller may read. Entities without an icon or not readable by the caller SHALL be omitted, not reported as errors.
- `set`: input `{ entityType, entityId, icon, color }`; creates or replaces the entity's icon and returns it.
- `clear`: input `{ entityType, entityId }`; removes the entity's icon if present and succeeds either way.

`icon` SHALL be validated as a kebab-case name (lowercase letters, digits and single hyphens) of at most 64 characters. `color` SHALL be validated against the fixed palette keys `orange`, `amber`, `green`, `teal`, `blue`, `violet`, `rose` and `neutral`. `entityType` SHALL be at most 64 characters and `entityId` at most 128.

#### Scenario: Batch read for a list

- **WHEN** `entityIcon.getMany` is called with ten collections of the caller, three of which have an icon
- **THEN** it SHALL return exactly those three icons in a single response

#### Scenario: Invalid icon or color

- **WHEN** `entityIcon.set` is called with an icon name like `"Book Open"` or a color that is not a palette key
- **THEN** input validation SHALL reject the request and nothing SHALL be stored

#### Scenario: Clearing an entity without an icon

- **WHEN** `entityIcon.clear` is called by an authorised user for an entity that has no icon
- **THEN** it SHALL succeed without error

### Requirement: Entity icons follow their entity's lifecycle

Because `entity_icons` has no foreign key to its targets, the handler that deletes a registered entity SHALL delete that entity's icon row in the same transaction. For collections, deleting a collection SHALL delete its `entity_icons` row.

#### Scenario: Deleting a collection removes its icon

- **WHEN** a user deletes a custom collection that has an icon
- **THEN** no `entity_icons` row with `entity_type = 'collection'` and that collection's id SHALL remain

### Requirement: Generated Lucide icon catalog

The repository SHALL provide a developer-run script, exposed as the root `package.json` script `icons:catalog` (running `apps/frontend/scripts/generate-icon-catalog.ts`), that generates the icon catalog the picker uses. The script SHALL read the `lucide-react` version installed for `apps/frontend`, take each icon's categories and tags from Lucide's upstream metadata for that exact version, take the category titles from the same metadata, and take each icon's geometry from the installed `lucide-react` package. It SHALL include only icons that exist in the installed package, and write a committed catalog inside the `entity-icons` feature listing categories (id and title) and icons (name, categories, tags, geometry), together with a generated TypeScript type of the category ids. Category titles and tags SHALL stay in English as Lucide publishes them. The catalog SHALL NOT be regenerated during builds, and generation SHALL be the only step that needs network access.

#### Scenario: Regenerating after a Lucide upgrade

- **WHEN** `lucide-react` is upgraded in `apps/frontend` and `bun run icons:catalog` is run
- **THEN** the catalog SHALL be rewritten for the new version, icons that no longer exist SHALL disappear from it and new icons SHALL appear with their categories

#### Scenario: Building without network

- **WHEN** the frontend is built or type-checked
- **THEN** it SHALL use the committed catalog and SHALL NOT fetch Lucide metadata

### Requirement: Fixed icon color palette

The frontend SHALL define a fixed palette of named icon colors as flat theme tokens with light and dark values in `apps/frontend/src/styles/global.css`, with no gradients. The palette keys SHALL be the same set the API validates, and `orange` SHALL map to the theme's primary color and be the default. Stored values SHALL be palette keys, never raw color values, so the theme can restyle every stored icon.

#### Scenario: Theme switch

- **WHEN** the user switches between light and dark theme
- **THEN** every rendered entity icon SHALL use its palette key's value for the active theme

### Requirement: Reusable icon picker

The frontend SHALL provide an `IconPicker` component in the `entity-icons` feature, controlled through `value` (`{ icon, color } | null`) and `onChange`, that knows nothing about any specific entity. It SHALL open from a trigger button that shows the current icon (or the `fallback` icon when there is none), and the panel SHALL contain:

- a search box that filters icons by case-insensitive match on the icon name and its tags;
- a category bar listing the offered categories plus an option for all of them, filtering the grid to one category;
- a grid of the icons that match the active category and search, rendered from the catalog geometry;
- the color palette swatches, with the grid and trigger previewing the selected color, unless color choice is disabled;
- an action to remove the icon, which sets the value to `null`.

The `variant` prop SHALL choose the container: `popover` (default) opens a compact panel anchored to the trigger, and `dialog` opens a larger panel in a centered modal with a title and a button to close it. Both variants SHALL offer the same search, categories, grid, colors and remove action.

The `allowColor` prop (default `true`) SHALL control whether the user can choose a color, and the `defaultColor` prop (a palette key, default `orange`) SHALL set the color preselected for new icons and used for the trigger's fallback icon. With `allowColor={false}` the swatches SHALL be hidden and every icon the user picks SHALL be emitted with `defaultColor`.

The `categories` prop SHALL accept Lucide category ids (typed from the generated catalog) and restrict both the category bar and the grid to icons in at least one of those categories; when omitted, every category SHALL be offered. The catalog SHALL be loaded only when the picker is first opened, not with the page. Icon buttons SHALL be operable with the keyboard and named with the icon name for assistive technology. UI copy around the picker (trigger label, placeholder, the "all" option, the remove action, empty results) SHALL be Spanish; category titles and icon names SHALL be shown in English.

#### Scenario: Restricting categories per screen

- **WHEN** a screen renders `IconPicker` with `categories={["finance", "shopping"]}`
- **THEN** the category bar SHALL show only those two categories plus the "all" option, and the grid SHALL never show an icon that belongs to neither

#### Scenario: Searching within a category

- **WHEN** the user selects a category and types a term in the search box
- **THEN** the grid SHALL show only icons of that category whose name or tags match the term, and an empty-state message when none do

#### Scenario: Picking an icon and color

- **WHEN** the user clicks an icon and a color swatch
- **THEN** `onChange` SHALL be called with that icon name and palette key, and the trigger SHALL show the chosen icon in that color

#### Scenario: Dialog variant

- **WHEN** a screen renders `IconPicker` with `variant="dialog"` and the user activates the trigger
- **THEN** the picker SHALL open centered in a modal instead of next to the trigger, and SHALL behave like the popover variant

#### Scenario: Color choice disabled

- **WHEN** a screen renders `IconPicker` with `allowColor={false}` and `defaultColor="violet"` and the user picks an icon
- **THEN** no color swatches SHALL be shown and `onChange` SHALL receive that icon with color `violet`

#### Scenario: Catalog loaded lazily

- **WHEN** a page renders a closed `IconPicker`
- **THEN** the catalog SHALL NOT be downloaded until the picker is opened

### Requirement: Entity-bound picker, display and batched loading

The `entity-icons` feature SHALL expose, through its public entry point (`@/features/entity-icons`):

- `EntityIconPicker`: takes an `entity` ref (`{ entityType, entityId }`) plus the `IconPicker` options, loads the entity's icon and persists each change through `entityIcon.set` / `entityIcon.clear`, the way `CommentsButton` owns an entity's comments.
- `EntityIcon`: takes an `entity` ref or an already-loaded icon value plus a `fallback` icon, and renders the stored icon in its palette color, or the fallback (in the default palette color unless another is given) when the entity has none, while it loads, or when the stored name is not a known Lucide icon. A single rendered icon SHALL download only that icon, never the whole catalog.
- `useEntityIcons(entities)`: loads the icons of a list of entities with one `entityIcon.getMany` request and exposes them by entity (`iconFor`), like `useCommentCounts`.
- `useSetEntityIcon` and `useClearEntityIcon` mutations for forms that hold the value themselves.

After a successful `set` or `clear`, every mounted `EntityIcon` and `useEntityIcons` consumer of that entity SHALL reflect the change without a page reload.

#### Scenario: Using the picker on a new entity type

- **WHEN** a developer registers a new entity type on the server and renders `<EntityIconPicker entity={{ entityType, entityId }} />` on its screen
- **THEN** the icon SHALL be loaded, chosen and persisted with no other frontend or database change

#### Scenario: Unknown stored icon

- **WHEN** an entity's stored icon name does not exist in the installed Lucide version
- **THEN** `EntityIcon` SHALL render the fallback instead of failing

### Requirement: Collections use entity icons

Custom collections SHALL be the first consumer of entity icons:

- The collection form dialog SHALL include an `IconPicker` (`variant="dialog"`, labelled "Icono de la colección") next to the name field, for both creating and editing a collection. It SHALL offer only the categories listed in `COLLECTION_ICON_CATEGORIES` and SHALL disable color choice, so collection icons are stored with the default color `orange`. Creating a collection with an icon SHALL store it after the collection is created; editing SHALL set or clear it only when it changed. If saving the icon fails, the collection SHALL stay saved and a Spanish error toast SHALL be shown. The dialog and the card's menu action SHALL be titled for editing ("Editar colección", "Editar"), not only renaming.
- Collection cards SHALL show each collection's icon, loaded for the whole list with a single `useEntityIcons` call, falling back to the custom-collection icon.
- The collection detail page SHALL show the collection's icon with the same fallback.
- The built-in favorites collection SHALL NOT offer an icon picker.

#### Scenario: Creating a collection with an icon

- **WHEN** the user creates a collection choosing the `book-open` icon
- **THEN** the new card SHALL show `book-open` in the primary (`orange`) color, and so SHALL the collection's detail page

#### Scenario: Collection without an icon

- **WHEN** a collection has no stored icon
- **THEN** its card and detail page SHALL show the custom-collection icon in the primary color
