# Frontend Component System

## Purpose

Defines the shadcn-based component system, typography roles, application-surface registry and the typed declarative APIs for resource views, query states, entity lists, metadata, filters, forms, pickers and CRUD overlays.

## Requirements

### Requirement: shadcn component setup

The frontend SHALL configure shadcn through `apps/frontend/components.json` with
the `base-nova` style (shadcn on Base UI), `rsc` disabled, `tsx` enabled,
Tailwind v4 CSS at `src/styles/global.css` with `baseColor` `neutral` and
`cssVariables` enabled, `lucide` as the icon library, and the aliases
`components` → `@/components`, `utils` → `@/lib/utils`, `ui` →
`@/components/ui`, `lib` → `@/lib` and `hooks` → `@/hooks`. New primitives
SHALL be added with `shadcn add` into `components/ui`, checking the shadcn
registry before writing a primitive by hand.

#### Scenario: A primitive is added from the registry

- **WHEN** a developer runs `shadcn add <component>` in `apps/frontend`
- **THEN** the component SHALL be generated under `src/components/ui` in the
  `base-nova` style, using CSS-variable theme tokens and lucide icons

#### Scenario: Aliases resolve inside generated code

- **WHEN** a generated component imports utilities, hooks or other primitives
- **THEN** those imports SHALL resolve through the `@/lib/utils`, `@/hooks` and
  `@/components/ui` aliases declared in `components.json`

### Requirement: Class merging with typography roles

The frontend SHALL expose a single `cn` class-merging helper from
`@/lib/utils`, built with `createCn` from the `cn` package and extended so the
role-based type utilities defined in `global.css` (`text-display`,
`text-headline`, `text-body`, `text-meta`, `text-meta-sm`, `text-label`,
`text-status`, `text-stat`) are registered as font sizes rather than text
colors. Components added with `shadcn add` that import `cn` from `"cn"` SHALL
have that import rewritten to `@/lib/utils`, and `shadcn migrate cn` MUST NOT be
run.

#### Scenario: A type role is merged with a text color

- **WHEN** `cn("text-label", "text-muted-foreground")` is evaluated
- **THEN** both classes SHALL be kept, so the role's size and the color both apply

#### Scenario: A later size overrides a role

- **WHEN** `cn("text-label", "text-xs")` is evaluated
- **THEN** `text-xs` SHALL replace the role's font size

#### Scenario: A registry component is added

- **WHEN** `shadcn add` generates a component importing `cn` from `"cn"`
- **THEN** the import SHALL be changed to `@/lib/utils` in the same change

### Requirement: Semantic typography roles

Product text SHALL be rendered through the `Text` component or
`textVariants({ role, tone })` from `components/shared/brand/typography.tsx`,
selecting a semantic role and a tone (`default`, `muted`, `primary`,
`destructive`) instead of hand-built size, weight, tracking and case utilities.
Role tokens (`--font-size-*`, `--line-height-*`, tracking tokens and a
`--text-<role>` theme entry per role) SHALL live in `src/styles/global.css`.
Adding a role SHALL update the tokens, `textVariants` and the `typeRoles` list
in `lib/utils.ts` together. `components/ui` primitives keep their own classes
and are styled from call sites through `className={textVariants(...)}`.

#### Scenario: Secondary copy is rendered

- **WHEN** a feature renders a description below a title
- **THEN** it SHALL use `Text` with the `meta` role and `muted` tone rather than
  `text-xs text-muted-foreground` utilities

#### Scenario: Text sits on a component that cannot be `Text`

- **WHEN** the text element is a primitive such as `DialogDescription` or
  `Input`
- **THEN** the role SHALL be applied through `textVariants({ role, tone })` on
  its `className`

### Requirement: Central application-surface identity

The frontend SHALL maintain one typed application-surface registry
(`lib/app-surfaces.ts`) for each surface's stable identifier, route metadata,
static title, label, description, semantic icon reference, authorization
visibility and optional navigation placement. Navigation models, page heroes and
Astro document titles SHALL derive equivalent values from that registry instead
of declaring independent copies, and icons SHALL be resolved through the central
icon registry (`lib/icon-registry.ts`).

#### Scenario: A navigable surface is added

- **WHEN** a developer registers a new navigable application surface
- **THEN** its navigation entries and static page identity SHALL be derivable
  from the same typed definition

#### Scenario: A surface icon changes

- **WHEN** a registered surface receives a different semantic icon reference
- **THEN** every registry-driven navigation and hero consumer SHALL resolve the
  new icon through the central icon registry

#### Scenario: A non-navigation surface is registered

- **WHEN** a detail, profile or error surface has no navigation placement
- **THEN** it SHALL remain addressable by surface identifier without appearing
  in navigation projections

#### Scenario: Registered surfaces render as overview cards

- **WHEN** the home page or a section overview renders registered destinations
- **THEN** one shared surface-card/grid API SHALL derive their labels,
  descriptions, icons, destinations and accessible link names from the registry

### Requirement: Typed declarative resource views

The frontend SHALL provide a typed resource-view composition API that owns the
standard page shell, surface hero, spacing, optional filters and query-result
region. A feature SHALL provide a static definition and a typed runtime view
model rather than recreating structural wrappers owned by that API.

#### Scenario: A conventional resource overview renders

- **WHEN** a feature supplies a valid resource definition and runtime view model
- **THEN** the shared view SHALL render the standard shell, hero, filters and
  result region with the design-system layout

#### Scenario: A feature needs dynamic behavior

- **WHEN** a resource action depends on permissions, local state or a mutation
- **THEN** the feature hook SHALL supply that behavior through a typed action or
  leaf renderer without transferring data-fetching ownership to the shared view

#### Scenario: A feature has a specialized result layout

- **WHEN** grouped or disclosure content cannot be represented by the standard
  entity list without feature-specific options
- **THEN** the resource view SHALL accept a named typed result renderer while
  continuing to own the page shell, hero and state regions

### Requirement: Complete shared query-state cascade

The shared query-state API SHALL render error, pending, empty, filtered-empty
and success states with consistent `StateCard` presentation, retry behavior and
action naming. It SHALL accept query-shaped data without importing feature
queries or mutation hooks.

#### Scenario: A query fails

- **WHEN** a resource query reports an error
- **THEN** the shared state API SHALL render the configured destructive error
  state and its available retry action

#### Scenario: Initial data is empty

- **WHEN** a successful resource query contains no items and no filter is active
- **THEN** the shared state API SHALL render the configured initial empty state

#### Scenario: Filters remove all results

- **WHEN** source data exists but the active filters produce no visible items
- **THEN** the shared state API SHALL render the configured filtered-empty state
  and clear-filter action

#### Scenario: Data is available

- **WHEN** the query succeeds with visible data
- **THEN** the shared state API SHALL pass the typed data to the result renderer

### Requirement: Descriptor-driven entity lists

The frontend SHALL provide a generic entity-list API whose typed definition
describes item identity, primary and secondary values, status, metadata,
navigation and row actions. The API SHALL own the quiet-editorial list surface,
responsive row structure, semantic list markup, hover/disabled treatment,
accessible action names and capped entrance timing.

#### Scenario: An entity collection renders

- **WHEN** a feature supplies items and a compatible entity-list definition
- **THEN** the list SHALL render one semantic list item per entity with values,
  metadata and actions obtained from typed descriptors

#### Scenario: A row exposes destructive actions

- **WHEN** an action descriptor is marked destructive
- **THEN** the shared action menu SHALL render it with destructive semantics and
  an accessible label that identifies the target row

#### Scenario: A row needs a rich leaf value

- **WHEN** a metadata value or status requires interactive or formatted content
- **THEN** a typed leaf renderer SHALL be allowed without giving the feature
  control of the row's structural layout

#### Scenario: A collection is grouped by the feature

- **WHEN** a feature groups entities into feature-specific sections
- **THEN** each group SHALL be able to reuse the same entity-row definition
  without adding grouping concerns to the base entity-list API

### Requirement: Valid declarative metadata

The metadata API SHALL accept typed data descriptors and SHALL own a valid
definition-list structure whenever definition-list semantics are requested.
Callers MUST NOT be required to author nested `dt` or `dd` elements inside a
metadata value.

#### Scenario: Metadata is rendered as a definition list

- **WHEN** a feature supplies metadata descriptors in definition-list mode
- **THEN** the shared API SHALL emit exactly one correctly associated `dt` and
  `dd` pair for each visible descriptor

#### Scenario: Metadata has an action

- **WHEN** a descriptor supplies an edit or copy action
- **THEN** the shared API SHALL place the action without breaking the definition
  term/value relationship

### Requirement: Declarative typed filters

The frontend SHALL provide filter definitions as a discriminated TypeScript
union for standard search, suggestion, select, date and categorical (facet,
include/exclude) controls. The shared filter region SHALL own labels,
responsive layout, active count, clear action and result count while features
retain ownership of filter persistence and record-matching logic. Below the
medium breakpoint the shared region SHALL render the action bar and bottom
sheet layout defined by `list-filter-experience` instead of the inline panel,
and SHALL derive removable chip descriptors from the same filter definitions.

#### Scenario: Standard filters render

- **WHEN** a feature supplies standard filter descriptors, current values and a
  typed setter
- **THEN** the shared region SHALL render labeled controls and derive active and
  clear behavior from their definitions

#### Scenario: A filter uses URL persistence

- **WHEN** a feature stores a filter value with its URL-state hook
- **THEN** the shared filter renderer SHALL consume that value and setter without
  changing the persistence mechanism

#### Scenario: A custom control is necessary

- **WHEN** a standard filter kind cannot represent an existing control such as
  a user picker
- **THEN** a typed custom-control renderer SHALL occupy only the control slot and
  the shared region SHALL continue to own its label and layout

#### Scenario: A categorical filter is declared

- **WHEN** a feature supplies a facet descriptor with options, an include and
  exclude value and a setter
- **THEN** the shared region SHALL count it as active while either set is
  non-empty and SHALL render its include/exclude option control without
  feature-specific markup

#### Scenario: Same definitions on a narrow viewport

- **WHEN** the same filter descriptors are rendered below the medium breakpoint
- **THEN** the shared region SHALL render the action bar and bottom sheet from
  them without the feature supplying a separate mobile definition

### Requirement: Typed conventional form definitions

Conventional form dialogs SHALL support a discriminated, key-safe field
definition API for text, email, password, textarea, select and checkbox values.
The form adapter SHALL own reset-on-open behavior, immutable field updates,
native validation attributes, accessible labels, hints and field errors.

#### Scenario: A simple dialog form opens

- **WHEN** a dialog opens with initial values and conventional field definitions
- **THEN** each field SHALL render with its typed value, accessible label and
  declared validation attributes

#### Scenario: The dialog is closed and reopened

- **WHEN** a user closes a form after editing and later reopens it
- **THEN** the form SHALL reseed its state from the current initial definition
  rather than retaining stale values

#### Scenario: A field key and control type disagree

- **WHEN** a developer assigns a field definition to an incompatible form-value
  key
- **THEN** TypeScript validation SHALL reject the definition at build time

#### Scenario: A complex form section is required

- **WHEN** a form contains a schedule builder, permission matrix, payload editor
  or equivalent one-off interaction
- **THEN** it SHALL use a named typed custom section while the shared dialog
  continues to own form chrome, submission and accessibility

### Requirement: Shared searchable entity picker

The frontend SHALL provide a typed searchable entity picker that owns search
input, loading and empty suggestions, result selection, selected-entity summary
and clear/change behavior. Feature code SHALL supply item identity, display
values and search state without rebuilding the picker structure.

#### Scenario: A user selects an entity

- **WHEN** search results are available and the user selects one
- **THEN** the picker SHALL display the selected summary and expose the typed
  selected entity to the containing form

#### Scenario: A selected entity is cleared

- **WHEN** the user activates the accessible clear or change action
- **THEN** the picker SHALL remove the selection and restore the search control

#### Scenario: Search has no result

- **WHEN** a searchable query completes with no matching entities
- **THEN** the picker SHALL render its configured empty suggestion state without
  changing the containing form's layout

### Requirement: Target-based CRUD overlay state

The frontend SHALL provide a typed local target-dialog state API for row-level
create, edit, detail and destructive confirmation flows. It SHALL expose the
current target and controlled open/close bindings while leaving mutation calls
inside feature-owned hooks or handlers.

#### Scenario: A row requests deletion

- **WHEN** a row action opens a destructive confirmation for an entity
- **THEN** the confirmation SHALL receive that typed target and derive its copy
  and mutation input without a second identifier lookup

#### Scenario: A controlled overlay closes

- **WHEN** the user cancels or a successful action closes the overlay
- **THEN** the target state SHALL be cleared consistently

### Requirement: Explicit abstraction boundary

A new public shared component SHALL represent at least three production uses
with the same intent, unless it is a necessary subcomponent of an already shared
public abstraction. One-off feature behavior SHALL remain feature-internal and
MUST NOT acquire unrelated variants merely to fit a shared API.

#### Scenario: Three equivalent implementations exist

- **WHEN** an audit identifies three production implementations with the same
  semantic intent and layout responsibility
- **THEN** the implementation SHALL be eligible for extraction behind one typed
  shared API and systematic migration

#### Scenario: A large component has one feature-specific use

- **WHEN** a large component contains multiple focused responsibilities but no
  equivalent production use elsewhere
- **THEN** it SHALL be split into feature-internal components rather than moved
  into the shared component system

### Requirement: Static validation of shared components

Each change to the shared component system SHALL pass Biome checks for the
affected files and frontend type checking before superseded code is removed.

#### Scenario: A feature migration is complete

- **WHEN** a feature no longer needs its previous hand-built composition
- **THEN** the affected Biome checks and frontend type check SHALL succeed before
  the superseded implementation is deleted

### Requirement: Behavioral and visual migration parity

Migration to declarative components SHALL preserve existing routes, access
control, queries, mutations, optimistic behavior, responsive behavior and
user-visible functionality. It SHALL also preserve the quiet-editorial design
rules and the documented exceptions for authentication and global chrome.

#### Scenario: An admin resource page is migrated

- **WHEN** users, organizations, teams, API keys, sessions, logs or plugins adopt
  the shared resource APIs
- **THEN** the same authorized users SHALL retain the same available data and
  actions at the same route

#### Scenario: The cron surface is migrated

- **WHEN** the cron overview adopts shared page, state, filter or row APIs
- **THEN** grouping, admin-only mutations, URL-backed filters and detail links
  SHALL continue to behave as before

#### Scenario: A documented visual exception is encountered

- **WHEN** authentication or global navigation uses a distinct layout
- **THEN** the migration SHALL preserve that exception and limit changes to
  genuinely shared behavior or feature-internal decomposition

### Requirement: In-page layouts respond to their container

In-page content layouts SHALL respond to their container. Content layouts rendered inside a page — card grids, metadata grids, filter
field grids, list row layouts and form field grids — SHALL choose their columns
and arrangement with Tailwind container queries: an ancestor marked
`@container` (or a named `@container/<name>`) and container variants such as
`@md:`, `@xl:` or `@4xl:`, never with viewport variants such as `sm:`, `lg:` or
`xl:`. Shared components SHALL establish their own container so callers do not
have to, and column overrides passed into them through `className` SHALL use
container variants. Viewport breakpoints SHALL remain only for things that
follow the browser window: app chrome (navbar, sidebar, the narrow-viewport
filter action bar and bottom sheet, the scroll-to-top button), the size of
dialogs, sheets and popovers, and page-level padding.

At least `SurfaceCardGrid`, `MetadataList`, `MetadataDefinitionList`, the
`CollapsibleFilters` field grid, the `EntityList` row and metadata layout,
admin session rows, the theme mode selector and the cron schedule builder SHALL
follow this rule.

#### Scenario: Sidebar open narrows a card grid

- **WHEN** a section overview with `SurfaceCardGrid` is shown on a 1280 px wide
  window with the section sidebar open, so the grid itself is about 800 px wide
- **THEN** the grid SHALL lay out the columns that fit 800 px (two), not the
  three a 1280 px viewport breakpoint would give

#### Scenario: Same component in a narrow and a wide place

- **WHEN** the same `MetadataList` with `columns={4}` is rendered in a
  full-width page and in a 400 px wide panel on the same screen
- **THEN** the full-width one SHALL show four columns and the narrow one a
  single column

#### Scenario: Chrome keeps viewport breakpoints

- **WHEN** the viewport is narrower than the medium breakpoint
- **THEN** the filter action bar, the navbar's collapsed menu and dialog widths
  SHALL still switch on the viewport width, independently of any container

#### Scenario: Override through className

- **WHEN** a caller widens one field of a shared metadata grid through
  `className`
- **THEN** the override SHALL use a container variant (for example
  `@xl:col-span-3`), not a viewport variant
