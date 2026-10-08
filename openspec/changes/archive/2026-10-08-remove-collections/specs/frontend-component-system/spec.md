## MODIFIED Requirements

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
