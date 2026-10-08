# Web Navigation

## Purpose

Defines the web navigation shell: authenticated and guest navbars driven by the surface registry, responsive menus, active link highlighting, account menu, admin entry point, page layouts, view-transition navigation and the navbar surface search.

## Requirements

### Requirement: Authenticated and guest navbars

The web layout SHALL render an authenticated navbar for signed-in users and a
guest navbar for public pages (such as login and registration) or when no
session exists. Both navbars SHALL show the "STACK" brand linking to `/`. The
guest navbar SHALL omit application navigation links, the surface search and
the user menu.

#### Scenario: Public page renders the guest navbar

- **WHEN** a page is rendered with the guest navbar flag enabled, or without a
  session
- **THEN** the layout SHALL show only the brand and the theme menu, without app
  links or account actions

#### Scenario: Application page renders the authenticated navbar

- **WHEN** a page is rendered for a signed-in user without the guest navbar flag
- **THEN** the layout SHALL show the brand, navigation links, the surface
  search, the theme menu and the user menu

### Requirement: Registry-driven navigation sections

The navbar, mobile menu, section sidebars and section overview pages SHALL read
their sections from `lib/site-nav.ts`, which is projected from the
application-surface registry (`lib/app-surfaces.ts`). Only surfaces that declare
a navigation placement SHALL appear as sections, and a section's child surfaces
SHALL appear as its sub-items. Navigation components MUST NOT hardcode labels,
descriptions or icons.

#### Scenario: Section with sub-routes

- **WHEN** a navigable surface has child surfaces (such as Configuración with
  Perfil and Apariencia)
- **THEN** the desktop navbar SHALL render it as a menu whose first row is the
  section hub followed by one row per sub-route, each with its icon, label and
  description from the registry

#### Scenario: Section without sub-routes

- **WHEN** a navigable surface has no child surfaces
- **THEN** the navbar SHALL render it as a plain link

### Requirement: Responsive navigation

The authenticated navbar SHALL show navigation links inline on large viewports
and collapse them into a slide-out menu on smaller viewports. At the `lg`
breakpoint only sections marked primary SHALL be inline, with the remaining
sections reachable through a "Más" menu; from `xl` up every section SHALL be
inline.

#### Scenario: Large viewport shows inline links

- **WHEN** the navbar is displayed on an `xl` or wider viewport
- **THEN** all navigation sections SHALL be shown inline

#### Scenario: Intermediate viewport uses an overflow menu

- **WHEN** the navbar is displayed between the `lg` and `xl` breakpoints
- **THEN** primary sections SHALL be inline and the other sections SHALL be
  available from the "Más" menu

#### Scenario: Small viewport shows the slide-out menu

- **WHEN** the navbar is displayed below the large breakpoint
- **THEN** the navigation links SHALL be available through a slide-out menu
  opened from a menu button

### Requirement: Active link highlighting

The navigation SHALL highlight the link matching the current path through
`isNavLinkActive(href, pathname)`. The home link MUST match only the exact root
path, while other links match when the current path equals the link's href or is
nested under it. Within a section, only the most specific matching row SHALL be
marked current, while the section trigger stays highlighted for any of its
sub-routes.

#### Scenario: Home is active only at root

- **WHEN** the current path is `/`
- **THEN** only the home link SHALL be highlighted

#### Scenario: Section link is active on nested paths

- **WHEN** the current path is nested under a section link's href (for example
  `/crons/<id>`)
- **THEN** that section link SHALL be highlighted

#### Scenario: Sub-route is the current row

- **WHEN** the current path is `/config/appearance`
- **THEN** the Apariencia row SHALL be current, the Configuración hub row SHALL
  NOT, and the Configuración trigger SHALL remain highlighted

### Requirement: Account menu

The user menu SHALL reflect the current session. When no user is authenticated
it SHALL present a sign-in action; when a user is authenticated it SHALL present
the user's name and email, a link to the profile, and a sign-out action.

#### Scenario: Anonymous user sees sign-in

- **WHEN** no authenticated user is present
- **THEN** the user menu SHALL render a sign-in action linking to the login page

#### Scenario: Authenticated user sees account actions

- **WHEN** a user is authenticated
- **THEN** the user menu SHALL display the user's name and email and offer
  profile (`/me`) and sign-out actions

#### Scenario: Signing out

- **WHEN** the user selects the sign-out action
- **THEN** the system SHALL end the session and redirect to the login page

### Requirement: Admin entry point

The admin panel (`/admin`) SHALL be a navigation section marked `adminOnly`, so
it SHALL be offered in the navbar, mobile menu and section overviews only to
users holding the `admin` role.

#### Scenario: Admin sees the admin section

- **WHEN** an authenticated user with the `admin` role views the navigation
- **THEN** it SHALL include the Admin section

#### Scenario: Non-admin does not see the admin section

- **WHEN** an authenticated user without the `admin` role views the navigation
- **THEN** no admin panel entry SHALL be offered

### Requirement: Page layouts

The frontend SHALL provide Astro layouts under `apps/frontend/src/layouts/`
chosen by navigation context, each route rendering exactly one `<main>`:
`Layout.astro` (navbar, page slot and site footer, with `guestNavbar`,
`hideFooter` and `scrollToTop` options), `WithSidebar.astro` (a section with
sub-surfaces and its section sidebar), `Detail.astro` (detail routes whose
parent is not a sidebar section, rendering `<main>` and a back link) and
`Admin.astro` (the `/admin` area inside the admin shell sidebar, redirecting to
`/login` without a user).

#### Scenario: Section page renders with its sidebar

- **WHEN** a route uses `WithSidebar.astro` for a section that declares
  sub-items
- **THEN** the page SHALL render the section sidebar listing that section's
  sub-surfaces next to the page content, without the site footer

#### Scenario: Sidebar keeps its state

- **WHEN** a user collapsed the section sidebar and loads another sidebar page
- **THEN** the sidebar SHALL render collapsed from the start, read from the
  `sidebar_state` cookie on the server

#### Scenario: Detail route outside a sidebar section

- **WHEN** a route such as `/crons/[id]` uses `Detail.astro`
- **THEN** it SHALL render a back link to its parent and a single `<main>`
  around the mounted island

### Requirement: Client-side navigation with view transitions

The layouts SHALL use Astro's `ClientRouter` so navigation between pages happens
client-side with view transitions. Navigation chrome (navbar, section sidebar
and its header) SHALL persist across swaps instead of remounting, while the page
content fades in.

#### Scenario: Navigating between pages

- **WHEN** the user follows an internal link
- **THEN** the page content SHALL be swapped with a fade transition and the
  navbar SHALL remain mounted with its state

### Requirement: Section-sidebar scroll restoration

Section-sidebar pages SHALL restore their content scroller offset. Pages under
the section-sidebar layout whose scroll persistence is enabled (the default)
SHALL save that offset per path plus query string and SHALL show the scroller at the saved offset as soon as the page is swapped in on
back/forward navigation, on a link to the same URL, or on a reload in the same
tab. They SHALL NOT wait for their islands to render or fetch data. Once a
navigation starts, the page being left SHALL save its offset under its own URL,
never under the destination's. The saved state SHALL include the height of the
page content, and the layout SHALL reserve that height until the content
renders. A page left while its reservation is still active SHALL save the
reserved height, not the height its content had reached. The reservation SHALL
be released at the first of these:

- the rendered content reaches the reserved height,
- the user presses a pointer or a key inside the scroller,
- the page is swapped out by a navigation (it is kept while the next page
  loads, so the page being left does not jump),
- a bounded time passes.

Only after the release MAY a page that is now shorter than before clamp the
offset. Pages that opt out of scroll persistence SHALL start at the top, save
nothing and reserve nothing. State saved without a content height SHALL still
restore its offset, without a reservation.

#### Scenario: Back navigation while the data is still loading

- **WHEN** the user leaves a section-sidebar list scrolled deep, opens one of
  its records, and goes back through history while the list's data takes
  several seconds to arrive
- **THEN** the list SHALL appear at the saved offset immediately, with empty
  space where the content will render
- **AND** the content SHALL render in place at that offset, without the page
  first showing the top

#### Scenario: Content arrives

- **WHEN** a restored page's rendered content reaches the reserved height
- **THEN** the reservation SHALL be released without changing the visible
  offset

#### Scenario: Content is now shorter

- **WHEN** a restored page renders less content than when it was left (for
  example, records were removed) and the bounded time passes
- **THEN** the reservation SHALL be released and the offset SHALL clamp to the
  new content's end

#### Scenario: User operates the page during the reservation

- **WHEN** the user presses a filter chip or any other control in the scroller
  while the reservation is active
- **THEN** the reservation SHALL be released at once, so a filter change that
  scrolls the list to the top leaves no empty space below the new result

#### Scenario: Filtered views keep their own offset

- **WHEN** the user scrolls a list filtered through the query string, leaves
  it, and later returns to the same list with the same filters and to the
  unfiltered list
- **THEN** each URL SHALL restore the offset it was left at

#### Scenario: Leaving a page does not overwrite the destination

- **WHEN** the user leaves a scrolled section-sidebar page for another one,
  through a link or through history
- **THEN** the offset SHALL be saved under the page being left, and the
  destination's saved offset SHALL stay unchanged

#### Scenario: Page opted out of scroll persistence

- **WHEN** the user navigates to a section-sidebar page that disables scroll
  persistence
- **THEN** the page SHALL start at the top, and no offset SHALL be saved and no
  height reserved

#### Scenario: State saved before content heights were stored

- **WHEN** the saved state for a URL has an offset but no content height
- **THEN** the page SHALL apply the offset once, without a reservation

### Requirement: Navbar surface search

The authenticated navbar SHALL offer a search that lets the user jump to any
registered application surface by typing part of its name. The searchable
destinations SHALL be projected from the application-surface registry
(`app-surfaces.ts`); no label, description or icon SHALL be declared in the
search component itself.

#### Scenario: Desktop shows a search trigger

- **WHEN** the authenticated navbar is displayed on a large (`lg` and up)
  viewport
- **THEN** the navbar actions SHALL include a search trigger that reads as a
  search field and shows the keyboard shortcut

#### Scenario: Small viewport shows an icon trigger

- **WHEN** the authenticated navbar is displayed below the large breakpoint
- **THEN** the navbar actions SHALL include an icon-only search trigger with an
  accessible name and a hover hint

#### Scenario: Guest navbar has no search

- **WHEN** a page is rendered with the guest navbar
- **THEN** no surface search trigger SHALL be rendered

#### Scenario: Opening with the trigger

- **WHEN** the user activates the search trigger
- **THEN** a search dialog SHALL open with the text input focused

#### Scenario: Opening with the keyboard shortcut

- **WHEN** the authenticated navbar is mounted and the user presses `⌘K` (macOS)
  or `Ctrl+K` (other platforms)
- **THEN** the search dialog SHALL open, and pressing the shortcut again while it
  is open SHALL close it

### Requirement: Searchable surfaces

The surface search SHALL list every registered surface whose route path has no
dynamic segment, excluding surfaces that opt out of search and, for users
without the `admin` role, surfaces marked `adminOnly`. A surface whose path has
a dynamic segment SHALL NOT be listed as a surface; it SHALL be reachable
through the search only by way of its records, when it declares a search source
(see "Searchable records of dynamic surfaces"). Results SHALL be grouped by
top-level section, and each result SHALL show the surface's icon, label and
description. The label of a sub-surface SHALL be preceded by the labels of its
parent sections, outermost first ("Configuración › Apariencia"), wherever the
result is listed, including the "Recientes" group.

#### Scenario: Dynamic routes are not listed

- **WHEN** the search dialog lists its destinations
- **THEN** surfaces whose path contains a dynamic segment (such as
  `/crons/[id]`) SHALL NOT appear as a surface entry with the unresolved path

#### Scenario: Opted-out surfaces are not listed

- **WHEN** the search dialog lists its destinations
- **THEN** the login, signup and not-found surfaces SHALL NOT appear

#### Scenario: Non-admin does not see admin surfaces

- **WHEN** a user without the `admin` role opens the search dialog
- **THEN** no `adminOnly` surface SHALL appear, whatever the query

#### Scenario: Admin sees admin surfaces

- **WHEN** a user with the `admin` role searches for "usuarios"
- **THEN** the admin users surface SHALL appear in the results

#### Scenario: Sub-surfaces are grouped under their section

- **WHEN** the search dialog lists the children of a section (such as the
  appearance page of the configuration)
- **THEN** they SHALL appear in a group headed by that section's label

#### Scenario: Sub-surfaces show their section trail

- **WHEN** the user types "apariencia"
- **THEN** the appearance result SHALL read "Configuración › Apariencia"

### Requirement: Searchable records of dynamic surfaces

The surface search SHALL include records of dynamic surfaces. A surface whose path has a dynamic segment can declare a search source in the
application-surface registry. The source SHALL enumerate the records the
signed-in user can open on that surface, using the same API permissions as the
pages that list them. Each record SHALL become a search result whose path is the
surface's path with its dynamic segments filled from that record, and whose
label and description come from the record. The cron detail surface SHALL list
the user's cron jobs.

Record results SHALL be shown only while the query is non-empty, SHALL be
matched case- and accent-insensitively against the record's label, description
and group label, and against the labels of its surface and of the concrete-path
surfaces its route sits under (so typing a section's name lists that section's
records), and SHALL appear in a group of their own per source with a Spanish
heading. Each record result SHALL show the icon of its surface, and its label
SHALL be preceded by the labels of the concrete-path surfaces its route sits
under ("Crons › Limpieza nocturna").
A source declared on an `adminOnly` surface SHALL NOT be queried for users
without the `admin` role. Records SHALL be loaded only while the search dialog
is open. While they load, or if loading fails, the static surface results SHALL
still be shown and searchable. Opening a record page SHALL NOT add it to the
"Recientes" group.

#### Scenario: Finding a cron job by name

- **WHEN** a user who owns a cron job named "Limpieza nocturna" opens the search
  dialog and types "limpieza"
- **THEN** a result reading "Crons › Limpieza nocturna" SHALL appear in the cron
  jobs group, and selecting it SHALL close the dialog and navigate to
  `/crons/<id of that job>`

#### Scenario: Typing the section name lists its records

- **WHEN** a user who owns cron jobs types "crons"
- **THEN** the Crons surface SHALL appear and every cron job of the user SHALL
  appear in the cron jobs group, whatever their names

#### Scenario: Empty query shows no records

- **WHEN** the user opens the search dialog without typing
- **THEN** no record results SHALL be listed

#### Scenario: Accent-insensitive record match

- **WHEN** a cron job is named "Sincronización" and the user types
  "sincronizacion"
- **THEN** that cron job SHALL appear in the results

#### Scenario: Records only for what the user can see

- **WHEN** two users each own cron jobs and one of them searches
- **THEN** the record results SHALL contain only the records the API returns for
  that user

#### Scenario: Loading or failing source does not block the search

- **WHEN** a search source is still loading or its request fails
- **THEN** matching surface results SHALL still be shown, and no error SHALL
  replace the dialog content

#### Scenario: No records are fetched while the dialog is closed

- **WHEN** an authenticated page is loaded and the search dialog has not been
  opened
- **THEN** no request SHALL be made to enumerate search-source records

#### Scenario: Current record is marked

- **WHEN** the user is on `/crons/<id>` and that cron job appears in the results
- **THEN** that result SHALL be visually marked as the current page

#### Scenario: Record pages are not recorded as recent

- **WHEN** the user visits `/crons/<id>` and later opens the search dialog
  without typing
- **THEN** the "Recientes" group SHALL NOT include that cron job

#### Scenario: Dynamic surface without a source stays out

- **WHEN** a surface with a dynamic segment declares no search source
- **THEN** neither the surface nor any of its records SHALL appear in the results

### Requirement: Server-searched record sources

A search source SHALL obtain its records through an endpoint of its own record
entity: its list endpoint when the entity is listed in full, its search endpoint
when the entity is listed in pages. A full-list source keeps the behavior of
"Searchable records of dynamic surfaces": it loads the list once while the
dialog is open and the dialog matches it locally. A source whose entity is
listed in pages (a server-searched source) SHALL instead ask its entity's search
endpoint for the records matching the user's text, with the same API
permissions as the pages that list those records, and SHALL list at most a fixed
number of records per source in the order the endpoint returns them.

A server-searched source SHALL be queried with the text the user settled on,
about 150 ms after the last keystroke, not once per keystroke. The words of the
query that match the labels of the source's own surface or of the concrete-path
surfaces its route sits under SHALL NOT be sent to the server, while the dialog
still matches them locally against the record. The source SHALL NOT be queried
when no word remains or when what remains is shorter than two characters, and
then it SHALL list no records. While the next answer loads, the records of the
previous answer SHALL stay listed.

A record SHALL be able to carry extra match terms besides its label and
description (for example an address the server matched on), and the dialog
SHALL match the query against them too, so a record the endpoint returned is not
filtered out because its match is not visible in its label. The rules of
"Searchable records of dynamic surfaces" on the dialog being open, empty
queries, `adminOnly` surfaces, loading or failing sources and recent pages SHALL
apply to server-searched sources as well.

#### Scenario: Full-list sources are unchanged

- **WHEN** the user types in the search dialog
- **THEN** the cron jobs source SHALL keep loading its full list once per open
  dialog and SHALL make no request per typed text

#### Scenario: A paginated source asks its own search endpoint

- **WHEN** a source is declared as server-searched and the user types "lectura"
- **THEN** the records listed for that source SHALL be the ones its entity's
  search endpoint returns for "lectura", not a page of its list endpoint

#### Scenario: Server search waits for the user to pause

- **WHEN** the user types a word into the dialog one character after another
  without pausing, with a server-searched source declared
- **THEN** that source SHALL be queried for the settled text, not once per
  keystroke

#### Scenario: Section words are not sent to the server

- **WHEN** a server-searched source sits under a section labelled "Crons" and the
  user types "crons limpieza"
- **THEN** that source SHALL be asked for "limpieza" only, and the records it
  returns SHALL still match the full query in the dialog

#### Scenario: A bare section name does not query the server

- **WHEN** the user types only the label of a server-searched source's section,
  or a single character besides it
- **THEN** that source SHALL NOT be queried and SHALL list no records, while the
  section's surface still appears

#### Scenario: Results are bounded

- **WHEN** more records match than the source's limit
- **THEN** that source's group SHALL list at most that many records

#### Scenario: Extra match terms keep a server match

- **WHEN** the search endpoint returns a record because its address contains the
  typed text, and the address is one of the record's extra match terms but not
  its label or description
- **THEN** that record SHALL be listed

#### Scenario: Previous answer stays while the next loads

- **WHEN** a server-searched source has listed records for one text and the user
  extends the text
- **THEN** the earlier records SHALL stay listed until the new answer arrives,
  and SHALL disappear when the text no longer qualifies for a server query

### Requirement: Recently visited surfaces

The surface search SHALL remember, in the browser's `localStorage` and scoped to
the signed-in user, the most recent searchable surfaces the user visited (at
most five, newest first), and SHALL list them first under a "Recientes" group
while the query is empty. A visit SHALL count only when the current path is
exactly a searchable surface's path. Storage failures SHALL NOT break the
search.

#### Scenario: Recent pages are suggested first

- **WHEN** the user has visited `/crons` and then `/config/profile`,
  navigates to `/config/appearance` and opens the search dialog without typing
- **THEN** a "Recientes" group SHALL appear first listing Perfil and then
  Crons

#### Scenario: Current page is not suggested as recent

- **WHEN** the user opens the search dialog on a page that is in their recent
  list
- **THEN** that page SHALL NOT appear in the "Recientes" group

#### Scenario: Typing hides the recent group

- **WHEN** the user types a query
- **THEN** the "Recientes" group SHALL be hidden and only the matching section
  groups SHALL be shown

#### Scenario: Recents are per user and respect visibility

- **WHEN** a different user signs in on the same browser, or a stored page is no
  longer searchable for the user
- **THEN** the dialog SHALL NOT suggest pages from the other user's history nor
  pages the user can't see

#### Scenario: Storage unavailable

- **WHEN** `localStorage` is unavailable or holds malformed data
- **THEN** the search dialog SHALL work without a "Recientes" group

### Requirement: Surface search matching and navigation

The surface search SHALL match the query case- and accent-insensitively against
each surface's label, description and parent section label. A query of several
words SHALL match a result only when every word is found in at least one of the
texts that result is matched against; this applies to surfaces and to record
results alike. The search SHALL show an empty state in Spanish when nothing
matches. Selecting a result SHALL close the dialog and navigate to the surface's
path through the View Transitions–aware client navigation.

#### Scenario: Accent-insensitive match

- **WHEN** the user types "configuracion"
- **THEN** the "Configuración" surface SHALL appear in the results

#### Scenario: Match through the parent section

- **WHEN** the user types "configuracion"
- **THEN** the configuration section and its sub-surfaces (such as "Apariencia")
  SHALL appear in the results

#### Scenario: Multi-word query narrows to one section

- **WHEN** the user types "configuracion tema"
- **THEN** the "Apariencia" surface (under "Configuración", described as
  choosing the theme) SHALL appear and the "Perfil" surface SHALL NOT

#### Scenario: Multi-word query across a record's section and name

- **WHEN** a cron job named "Limpieza nocturna" exists and the user types
  "crons limpieza"
- **THEN** the result reading "Crons › Limpieza nocturna" SHALL appear in the
  cron jobs group

#### Scenario: No matches

- **WHEN** the query matches no searchable surface
- **THEN** the dialog SHALL show an empty-state message and no results

#### Scenario: Selecting a result

- **WHEN** the user selects a result with the pointer or with `Enter` on the
  highlighted item
- **THEN** the dialog SHALL close and the app SHALL navigate to that surface's
  path

#### Scenario: Current page is marked

- **WHEN** the search dialog lists the surface for the current path
- **THEN** that result SHALL be visually marked as the current page
