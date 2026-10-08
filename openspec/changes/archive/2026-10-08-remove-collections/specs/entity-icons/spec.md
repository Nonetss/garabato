## MODIFIED Requirements

### Requirement: Polymorphic entity icon storage

The database SHALL store entity icons in an `entity_icons` table with `id` (uuid primary key), `entity_type` (text, not null), `entity_id` (text, not null), `icon` (text, not null — a Lucide icon name in kebab-case), `color` (text, not null, default `'orange'` — a palette key), `created_by` (text, references the user, `ON DELETE SET NULL`), `created_at` and `updated_at`. A unique index on `(entity_type, entity_id)` SHALL guarantee at most one icon per entity. The table SHALL NOT carry a foreign key to any target table, and target tables SHALL NOT carry an icon column. `entity_id` SHALL be text so that both uuid-backed records and Better Auth string ids can be referenced.

#### Scenario: One icon per entity

- **WHEN** an icon is stored for an entity that already has one
- **THEN** the existing row SHALL be updated in place and no second row for that `(entity_type, entity_id)` SHALL exist

#### Scenario: Target tables carry no icon column

- **WHEN** the `@nonete/db` schema is inspected
- **THEN** no table of a registered entity type SHALL have an icon or color column, and icons SHALL live only in `entity_icons`

### Requirement: Icon-capable entity types are registered server-side

`@nonete/api` SHALL keep a registry of the entity types that can carry an icon (`packages/api/src/v1/entity-icon/targets.ts`). Each entry SHALL define how to decide, for the calling user and a batch of entity ids of that type, which of those entities the caller may read and which the caller may modify. Every `entityIcon` procedure SHALL consult this registry. A request naming an `entityType` that is not registered SHALL fail with `BAD_REQUEST`. The registry MAY be empty, in which case every `entityIcon` procedure SHALL fail with `BAD_REQUEST`. Registering a new entity type SHALL require only a new registry entry, with no change to the table, the procedures or the frontend components.

#### Scenario: Unregistered entity type

- **WHEN** any `entityIcon` procedure is called with an `entityType` that is not in the registry
- **THEN** it SHALL fail with `BAD_REQUEST` and SHALL NOT read or write `entity_icons`

#### Scenario: Caller may modify the entity

- **WHEN** a signed-in user calls `entityIcon.set` for an entity of a registered type that the registry entry reports as writable by that user
- **THEN** the icon SHALL be stored and returned

#### Scenario: Caller may not modify the entity

- **WHEN** a signed-in user calls `entityIcon.set` or `entityIcon.clear` for an entity of a registered type that the registry entry does not report as writable by that user, including one that does not exist
- **THEN** the call SHALL fail with `NOT_FOUND` and a Spanish message, without revealing whether the entity exists

### Requirement: Entity icon API

The API SHALL expose an `entityIcon` feature under `packages/api/src/v1/entity-icon/` (input, output, handler, router), wired as `entityIcon` in the v1 router and reachable as `orpc.v1.entityIcon.<method>()`. Every procedure SHALL require a signed-in user (`protectedProcedure`). It SHALL provide:

- `getMany`: input `{ entities: { entityType, entityId }[] }` (1 to 100 entries); output the icons (`entityType`, `entityId`, `icon`, `color`) of those entities that have one and that the caller may read. Entities without an icon or not readable by the caller SHALL be omitted, not reported as errors.
- `set`: input `{ entityType, entityId, icon, color }`; creates or replaces the entity's icon and returns it.
- `clear`: input `{ entityType, entityId }`; removes the entity's icon if present and succeeds either way.

`icon` SHALL be validated as a kebab-case name (lowercase letters, digits and single hyphens) of at most 64 characters. `color` SHALL be validated against the fixed palette keys `orange`, `amber`, `green`, `teal`, `blue`, `violet`, `rose` and `neutral`. `entityType` SHALL be at most 64 characters and `entityId` at most 128.

#### Scenario: Batch read for a list

- **WHEN** `entityIcon.getMany` is called with ten readable entities of a registered type, three of which have an icon
- **THEN** it SHALL return exactly those three icons in a single response

#### Scenario: Invalid icon or color

- **WHEN** `entityIcon.set` is called with an icon name like `"Book Open"` or a color that is not a palette key
- **THEN** input validation SHALL reject the request and nothing SHALL be stored

#### Scenario: Clearing an entity without an icon

- **WHEN** `entityIcon.clear` is called by an authorised user for an entity that has no icon
- **THEN** it SHALL succeed without error

### Requirement: Entity icons follow their entity's lifecycle

Because `entity_icons` has no foreign key to its targets, the handler that deletes an entity of a registered type SHALL delete that entity's icon row in the same transaction.

#### Scenario: Deleting an entity removes its icon

- **WHEN** a user deletes an entity of a registered type that has an icon
- **THEN** no `entity_icons` row with that entity's `entity_type` and id SHALL remain

## REMOVED Requirements

### Requirement: Collections use entity icons

**Reason**: The collections capability is removed, so entity icons have no consumer for now.
**Migration**: None. A future entity type opts in by adding a registry entry and rendering `EntityIconPicker` / `EntityIcon`.
