## Why

Pages under the section-sidebar layout scroll inside `<main data-app-scroller>`, not the window, so Astro's own scroll restoration never applies to them. When the user comes back to one of these pages, `useElementScrollRestoration` gets a freshly swapped `<main>` whose `client:only` islands have not rendered yet. The saved offset is clamped to 0, and the hook keeps retrying for 2.5 s (resize and mutation observers plus a 50 ms interval) while the islands mount and fetch. The restore is a race against data loading: slow responses, staggered islands or a long first render leave the user at the top.

The same hook also keys the saved offset by pathname only, although list filters live in the query string (`useQueryParam` writes them with `history.replaceState`), and it resolves the key while navigation is already under way, so the offset of the page being left can be stored under the next page's key.

## What Changes

- The inset scroll restoration saves the height of the page content along with the offset.
- When restoring, it reserves that height on the content wrapper before setting the offset, so the offset is applied once, on the first layout, without being clamped.
- The reservation is released when the rendered content reaches the reserved height, when the user operates the page (pointer or key), when the page is swapped out by the next navigation, or after a bounded timeout. Only then can a genuinely shorter page clamp the offset.
- The retry loop (resize and mutation observers, 50 ms interval, 2.5 s give-up) is removed.
- Restores run synchronously on `astro:after-swap`, so the swapped-in page is first painted at its offset instead of at the top.
- The saved state is keyed per path plus query string, and the key is frozen once a navigation starts (`popstate`, `astro:before-preparation`), so leaving a page never writes its offset under the destination's key.
- Saved entries without a stored height (written before this change) still restore their offset, without a reservation.
- The unused window-based `useScrollRestoration` hook is removed from `hooks/use-scroll-restoration.ts`.
- Unchanged: `persistScroll={false}` pages still start at the top and save nothing; the restoration stays mounted in the persisted `WithSidebarHeader` island.
- Out of scope: removing `<ClientRouter />`, a page-owned restoration mode for virtualized lists, TanStack Virtual `initialMeasurementsCache`, and reloading extra infinite-scroll pages.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `web-navigation`: adds a requirement for how section-sidebar pages save and restore their inset scroll position: per path plus query string, shown immediately at the saved offset while the content loads, with the reserved space released as defined above.

## Impact

- `apps/frontend/src/hooks/use-scroll-restoration.ts`: new save/restore model (offset plus content height, reservation instead of retries, resolver-based target, restore on `astro:after-swap`); `useScrollRestoration` removed.
- `apps/frontend/src/features/app-shell/sidebar/components/with-sidebar-header.tsx`: resolves the scroller, the content wrapper and the storage key from the swapped DOM and passes them to the hook.
- `apps/frontend/src/layouts/WithSidebar.astro`: marks the content wrapper with `data-app-scroll-content` and turns off scroll anchoring on the scroller.
- `apps/frontend/tests/hooks/`: new unit test for the hook.
- `.agents/skills/stack/references/frontend/navigation-and-layouts.md`: documents `persistScroll` and the reservation.
- No API, database, dependency or backend changes.
