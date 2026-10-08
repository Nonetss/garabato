## ADDED Requirements

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
