## ADDED Requirements

### Requirement: Light, dark and system theme modes

The application SHALL let the user choose between the `light`, `dark` and
`system` theme modes from a theme menu in both the authenticated and guest
navbars and from the theme mode selector on the appearance configuration page.
The resolved theme SHALL be applied by toggling the `dark` class on the document
root, where `system` resolves to the operating system's `prefers-color-scheme`.

#### Scenario: User selects a theme mode

- **WHEN** the user selects `light` or `dark` in the theme menu
- **THEN** the document root SHALL have the `dark` class only when `dark` was
  selected

#### Scenario: User selects the system mode

- **WHEN** the user selects `system`
- **THEN** the document root SHALL have the `dark` class only when the operating
  system prefers a dark color scheme

#### Scenario: Current mode is marked

- **WHEN** the theme menu or the appearance selector is shown
- **THEN** the currently active mode SHALL be visually marked and the navbar
  trigger SHALL show that mode's icon

### Requirement: Persist theme preference

The application SHALL persist an explicit theme choice in `localStorage` under
the `theme` key so the choice survives reloads and future visits. Selecting the
`system` mode SHALL remove the stored value, so the absence of a stored value
means `system`.

#### Scenario: Explicit preference is stored

- **WHEN** the user selects `light` or `dark`
- **THEN** that value SHALL be written to `localStorage` under `theme`

#### Scenario: System preference clears storage

- **WHEN** the user selects `system`
- **THEN** the `theme` key SHALL be removed from `localStorage`

### Requirement: Apply theme before paint

The application layouts (`Layout.astro` and `Admin.astro`) SHALL apply the
stored theme, defaulting to the system preference, from an inline script before
the page renders, SHALL re-apply it across client-side navigations, and SHALL
re-apply it when the operating system color scheme changes, preventing a flash
of the wrong theme.

#### Scenario: Stored theme applied on load

- **WHEN** a page loads with a stored theme preference
- **THEN** the theme SHALL be applied before first paint

#### Scenario: No stored preference

- **WHEN** a page loads without a stored theme preference
- **THEN** the theme SHALL follow the operating system's `prefers-color-scheme`

#### Scenario: Theme preserved across client navigation

- **WHEN** the user navigates between pages via client-side transitions
- **THEN** the stored theme SHALL be re-applied to the swapped document

### Requirement: Theme-aware overlays

UI surfaces rendered outside the page flow (such as toast notifications) SHALL
derive their theme from the `dark` class on the document root and SHALL update
live when the theme changes, without requiring a theme provider.

#### Scenario: Toasts match the current theme

- **WHEN** a toast is displayed
- **THEN** it SHALL render in the theme currently applied on the document root

#### Scenario: Toasts follow a live change

- **WHEN** the user changes the theme while the toaster is mounted
- **THEN** subsequent toasts SHALL render in the new theme

### Requirement: Animated theme transition

A theme change SHALL animate when the browser allows it. When the browser supports the View Transitions API and the user has not
requested reduced motion, a theme change SHALL animate as a circular reveal
originating from the pointer position of the selection; otherwise the change
SHALL apply immediately.

#### Scenario: Supported browser animates the change

- **WHEN** the user selects a theme mode in a browser that supports view
  transitions
- **THEN** the change SHALL animate as a circular reveal from the click position

#### Scenario: Unsupported browser applies immediately

- **WHEN** the user selects a theme mode in a browser without view transition
  support
- **THEN** the change SHALL apply immediately without animation

#### Scenario: Reduced motion applies immediately

- **WHEN** the user prefers reduced motion
- **THEN** the change SHALL apply immediately without animation
