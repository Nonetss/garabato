## MODIFIED Requirements

### Requirement: Long list pages offer a scroll-to-top control

A page that opts in (through the layout's `scrollToTop` prop) SHALL show a floating circular "Volver arriba" button in the bottom-right corner once its content (the window or its app scroll container) has scrolled more than 400 px, and SHALL hide it again when scrolled back above that threshold. Showing and hiding SHALL animate (fade, zoom and slide, 200 ms). Activating it SHALL smoothly scroll the window and every app scroll container to the top. The button SHALL have the accessible name "Volver arriba", SHALL be 44 px on narrow viewports and 36 px from the medium breakpoint, SHALL respect the device safe areas, and SHALL sit above the filter action bar while that bar is visible, dropping to the corner when the bar hides. Pages that do not opt in SHALL never show it, including after a client-side navigation from a page that does. The crons overview and cron detail pages, the admin users, organizations, teams and logs pages, and the traces page SHALL opt in.

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

#### Scenario: Traces page opts in

- **WHEN** a user scrolls the traces page 500 px down
- **THEN** the "Volver arriba" button SHALL fade in at the bottom-right corner
