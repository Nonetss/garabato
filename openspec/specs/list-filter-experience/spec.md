# List Filter Experience

## Purpose

Defines how list pages present filters: a bottom action bar and sheet on narrow viewports, removable active-filter chips, include/exclude facet options and an opt-in scroll-to-top control.

## Requirements

### Requirement: Narrow viewports filter through an action bar and a bottom sheet

Below the medium breakpoint (768 px), a list page with filters SHALL NOT show the inline filter panel and SHALL instead show a fixed bottom action bar with a "Filtros" control that reads "Filtros · N" when N filters are active, plus the list's sort control when the page supplies one. The bar SHALL respect the device bottom safe area, SHALL slide out of view while the user scrolls down past the top 48 px (ignoring movements under 8 px) and SHALL slide back in while scrolling up or when back near the top. "Filtros" SHALL open a bottom sheet titled "Filtros" holding one labelled section per filter, a "Limpiar" action when the list can clear filters, and a confirm button. Categorical (facet) sections SHALL be edited as a draft that is applied only when the user confirms and discarded when the sheet is dismissed; the other filter kinds SHALL apply as the user edits them. At the medium breakpoint and above the page SHALL keep the inline panel and apply every change immediately.

#### Scenario: Opening the sheet from the action bar

- **WHEN** a user on a 390 px wide viewport with two active filters taps "Filtros · 2" on the crons page
- **THEN** a bottom sheet titled "Filtros" SHALL open with a section per filter

#### Scenario: The confirm button shows the resulting count

- **WHEN** the sheet is open and the current filter combination matches 12 items
- **THEN** the confirm button SHALL read "Ver 12 resultados"
- **AND** it SHALL read "Ver 1 resultado" for one item, "Sin resultados" for zero items, and "Cargando…" while the count is not yet known

#### Scenario: A draft with no results can still be applied

- **WHEN** the draft facet selection matches no items
- **THEN** the confirm button SHALL read "Sin resultados" and pressing it SHALL apply the draft and close the sheet

#### Scenario: Dismissing discards the facet draft

- **WHEN** a user changes facet options in the sheet and closes it without confirming
- **THEN** the active facet filters SHALL be those that were active before opening it
- **AND** reopening the sheet SHALL show those live values

#### Scenario: Clearing from the sheet

- **WHEN** a user taps "Limpiar" in the sheet
- **THEN** every filter SHALL be cleared and the sheet SHALL close

#### Scenario: The bar hides while reading down

- **WHEN** a user scrolls a long list down past the top of the page
- **THEN** the action bar SHALL slide out below the viewport
- **AND** scrolling up SHALL bring it back

#### Scenario: Wide viewport keeps the inline panel

- **WHEN** the same page is shown at 1024 px wide
- **THEN** no action bar or sheet SHALL render and the collapsible inline filter panel SHALL be shown

### Requirement: Active filters are shown as removable chips

A list page with any active filter SHALL show each active filter value as a chip above the list at every width, labelled "<dimension>: <value>" (an excluded facet option reads "<dimension>: no <value>" and is styled as destructive), together with a "Limpiar" action when the list can clear filters. Removing a chip SHALL remove only that value. When no filter is active no chip row SHALL render.

#### Scenario: Removing one chip

- **WHEN** role filter `admin` and search `ana` are active and the user removes the search chip
- **THEN** only the role filter SHALL remain active

#### Scenario: Clearing all filters

- **WHEN** the user activates the chips' "Limpiar"
- **THEN** every filter SHALL be removed and the chip row SHALL disappear

#### Scenario: Chip controls are accessible

- **WHEN** a chip is rendered
- **THEN** its remove control SHALL have the accessible name "Quitar filtro: <chip label>" and a touch target of at least 44 px

### Requirement: Categorical options support include and exclude

A categorical (facet) filter SHALL present its options as a list where a checkbox includes an option and a separate control excludes it; an option SHALL never be included and excluded at once. When the list provides per-option counts each option SHALL show its count, and an unselected option with a zero count SHALL be visually de-emphasized; when it provides none, options SHALL render without counts. A dimension with more than eight options SHALL offer a text box to narrow the options by label. A dimension marked as not excludable SHALL hide the exclude control. In the mobile sheet facet sections SHALL be collapsible and open by default only when already active; in the wide inline panel each facet SHALL be a trigger summarizing the selection ("Todos", the first label, or the first label plus "+N") that opens the option list in a popover.

#### Scenario: Excluding an option

- **WHEN** a user presses the exclude control of an option that is currently included
- **THEN** the option SHALL move from included to excluded and its label SHALL be shown struck through

#### Scenario: Narrowing a long option list

- **WHEN** a facet has 12 options
- **THEN** a "Buscar en <dimension>…" text box SHALL be shown above them and typing SHALL hide options whose label does not contain the text

#### Scenario: Inline summary

- **WHEN** at a wide viewport a facet has one option `Activo` included and another option `Deshabilitado` excluded
- **THEN** its trigger SHALL read "Activo +1"

### Requirement: Long list pages offer a scroll-to-top control

A page that opts in (through the layout's `scrollToTop` prop) SHALL show a floating circular "Volver arriba" button in the bottom-right corner once its content (the window or its app scroll container) has scrolled more than 400 px, and SHALL hide it again when scrolled back above that threshold. Showing and hiding SHALL animate (fade, zoom and slide, 200 ms). Activating it SHALL smoothly scroll the window and every app scroll container to the top. The button SHALL have the accessible name "Volver arriba", SHALL be 44 px on narrow viewports and 36 px from the medium breakpoint, SHALL respect the device safe areas, and SHALL sit above the filter action bar while that bar is visible, dropping to the corner when the bar hides. Pages that do not opt in SHALL never show it, including after a client-side navigation from a page that does. The crons overview and cron detail pages, the admin users, organizations, teams and logs pages, and the signatures page SHALL opt in.

#### Scenario: Appears after scrolling a long list

- **WHEN** a user scrolls the admin users page 500 px down
- **THEN** the "Volver arriba" button SHALL fade in at the bottom-right corner

#### Scenario: Returns to the top

- **WHEN** the user activates "Volver arriba"
- **THEN** the page SHALL scroll smoothly to its top and the button SHALL animate out

#### Scenario: Clears the filter action bar

- **WHEN** on a narrow viewport the button is visible and the filter action bar is shown
- **THEN** the button SHALL be positioned above the bar
- **AND** when the bar slides out the button SHALL move down to the corner

#### Scenario: Page without opt-in

- **WHEN** a user navigates client-side from the crons page to a page that does not opt in and scrolls it past 400 px
- **THEN** no scroll-to-top button SHALL be shown

#### Scenario: Signatures page opts in

- **WHEN** a user scrolls the signatures page 500 px down
- **THEN** the "Volver arriba" button SHALL fade in at the bottom-right corner
