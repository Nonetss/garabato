## MODIFIED Requirements

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
