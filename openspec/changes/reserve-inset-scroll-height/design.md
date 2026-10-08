## Context

`WithSidebar.astro` renders `Layout` with `hideFooter`, which locks the body to the viewport. Scrolling happens in `<main data-app-scroller>`, whose children are the `WithSidebarHeader` island (a sticky navbar spacer, `transition:persist="sidebar-header"`) and the content wrapper holding the page slot (`transition:name="sidebar-page"`). `<main>` itself is not persisted, so every ClientRouter navigation swaps it in fresh and moves the persisted header into the new one.

`WithSidebarHeader` is the only consumer of `useElementScrollRestoration`. On each render it resolves the scroller, derives the key `app-shell-inset:<pathname>` (or `undefined` when the scroller carries `data-persist-scroll="false"`) and passes a ref plus that key to the hook. The hook restores in a layout effect that re-runs when the key changes, which happens after `usePathname` updates through a React render. On restore it writes `scrollTop`, and while the content is too short the browser clamps it to 0. A `ResizeObserver`, a `MutationObserver` and a 50 ms interval then keep rewriting it for up to 2.5 s, with guards so that clamped values do not overwrite the saved offset. Every page island is `client:only`, so the swapped `<main>` holds no rendered content until the islands load, render and get their data. The restore is therefore a race against loading.

Two more gaps sit in the same code:

- The key ignores the query string, while list filters are written there through `useQueryParam` (`history.replaceState`). Every filtered view of a list shares one offset.
- Saving on `astro:before-swap` and on cleanup reads the key captured at the last render, and swap-time scroll events (the old page clamping as the new one swaps in) are not ignored, so the page being left can save a clamped offset, and a query-only navigation can save under the wrong key.

`/opt/dev/console` already shipped this model (its own `reserve-inset-scroll-height` change, on top of earlier fixes for the key and the persisted mount point). This change ports it, adapted to this repo's mount point and without its `"owned"` mode.

## Goals / Non-Goals

**Goals:**

- Apply the saved offset once, in the same frame as the swap, without clamping and without retries.
- Key the saved state per path plus query string, and never save a page's offset under another page's key.
- Keep the existing contracts: `persistScroll={false}` starts at the top and saves nothing, reloads in the same tab restore, and the list-filter rule that a user filter change scrolls to the top still holds.

**Non-Goals:**

- Removing `<ClientRouter />` for the bfcache. That would lose the persisted sidebar chrome and the TanStack Query cache that survives navigations through the singleton in `lib/query-client.ts`.
- A page-owned restoration mode (`persistScroll="owned"` in `console`): no page here owns its scroll restoration.
- Moving the restoration into the sidebar chrome island as `console` did. The header island is already persisted and outside the fading page slot, which is all the hook needs.
- TanStack Virtual `initialMeasurementsCache` and reloading extra infinite-scroll pages (see Risks).
- Avoiding the first frame at the top on a hard reload, before the header island hydrates. That would need an inline script.

## Decisions

### Reserve the content height instead of waiting for it

The state saved under the key becomes `{ scrollY, contentHeight }`, written through `createViewState` (`lib/view-state.ts`, which already supports extra fields). On restore, the content wrapper gets `style.minHeight = <contentHeight>px`, then `scrollTop = scrollY` is set once.

- Alternative: keep the retry loop and lengthen it. Rejected: it is still a race, and every guard it needs stays.
- Alternative: drop the router or move to a SPA router. Rejected: see Non-Goals.

### Reserve on the content wrapper, measured by its children

The reservation goes on the content wrapper, never on `<main>`: a `min-height` on the scroller would grow its box instead of its scroll range. `WithSidebar.astro` marks the wrapper with `data-app-scroll-content`, and the header resolves it as a direct child of the scroller.

The natural content height is the bottom of the wrapper's lowest laid-out child minus the wrapper's top, plus its bottom padding, descending through `display: contents` wrappers (`astro-island`). It is measured this way rather than by clearing `min-height` and reading `offsetHeight`, because that read forces a layout that would clamp the offset mid-restore. The same measure feeds the saved `contentHeight` and the release check. While a reservation is still active, the saved height is the larger of the measured height and the reservation, so leaving early (for example, going back again at once) does not shrink the next reservation. The final save when the page stops uses the last measured height, because by then the old wrapper is detached and measures 0.

The scroller gets `[overflow-anchor:none]` so that content rendering inside the reserved space never makes the browser adjust the applied offset.

### Resolve the target on mount and on every `astro:after-swap`

The hook's signature becomes `useElementScrollRestoration(resolveTarget)`, where `resolveTarget` returns `{ scroller, content, resolveStorageKey } | null` read from the current DOM. The hook starts a restoration for the resolved target in its layout effect (first load, reload) and, from a DOM listener, again synchronously on `astro:after-swap`, stopping the previous page's restoration first. `astro:after-swap` runs inside the view transition's update callback, right after the new `<main>` is in the DOM, so the swapped page is first painted at its restored offset. The re-render through `usePathname` no longer drives restoration.

`WithSidebarHeader` passes a module-level resolver, so its identity is stable. The resolver reads `data-persist-scroll` from the scroller: `"false"` returns a target with no storage key (snap to 0, save nothing); otherwise the key resolver returns `app-shell-inset:${location.pathname}${location.search}`. The persist flag stays a DOM attribute, not an island prop, because the persisted island would freeze the first page's value.

- Alternative: keep the ref plus a string key. Rejected: the key would still be read at render time, after `location` has moved on.

### Freeze the key once a navigation starts

The key is resolved again on each save while the page is current, so a `history.replaceState` filter change is picked up without restarting the restoration. On `popstate` or `astro:before-preparation` the key is frozen: `location` is about to point at the destination. Scroll events after that are ignored, since they come from the swap, not the user. Saves happen on user scrolls, `astro:before-preparation`, `astro:before-swap`, `pagehide` (a reload keeps the URL) and when the restoration stops.

### Release rules

The reservation (`min-height` cleared) is released at the first of these:

- **Content arrived.** The natural height reaches the reservation minus 1 px, checked in an animation frame scheduled from a `ResizeObserver` on the wrapper's children plus a `MutationObserver` on the wrapper (childList, subtree) that picks up new children.
- **User intent.** `pointerdown` or `keydown` inside the scroller. This keeps the list-filter "change scrolls to top" rule free of a trailing gap.
- **Swapped out.** When the page's restoration stops: on `astro:after-swap` for the next page, or on unmount. It is not released when navigation starts, because the old page stays on screen while the next one loads and dropping its `min-height` would make it jump.
- **Timeout.** `RESERVE_MS = 10000`, longer than today's 2.5 s because waiting now costs only empty space at the right offset, not a wrong position.

Wheel and touch scrolling do not release it, so the user can scroll through reserved space while the content is still arriving.

### Mode handling

- **Default:** save, restore and reserve.
- **`persistScroll={false}`:** snap to 0, no save, no reservation.
- **Legacy entries** (no `contentHeight`, including those saved under the old pathname-only key): apply `scrollTop` once, no reservation.

### Code style

The port follows this repo's TypeScript style (`stack` skill, `references/code-style.md`): no casts, no `??` with a non-literal default, no ternaries inside expressions; defaults go in small named functions with early returns.

## Risks / Trade-offs

- **[Visible gap while slow data loads]** The user sees empty space at the right offset instead of content. → This is the intended trade. The space is released as soon as content fills it, or on interaction, swap-out or the timeout.
- **[Infinite-scroll lists whose extra pages are no longer cached]** Only the first page renders, its sentinel stays above the viewport and never fires, and the reservation stands until the timeout; then the offset clamps, as it does today. → Most returns still hit the TanStack Query cache within `gcTime`. Out of scope here.
- **[Child measurement misses absolutely positioned or transformed content]** The release would trigger late, and the timeout bounds it. Page roots are normal-flow blocks today.
- **[Offsets saved under the old pathname-only key are not found]** The first return to a filtered URL after the deploy starts at the top. → sessionStorage is per tab and short-lived; nothing to migrate.
- **[happy-dom has no layout]** Unit tests stub `getBoundingClientRect` and `scrollTop` clamping on the elements involved. The real-frame behavior (no top frame on back navigation) is confirmed in the browser by the user.

## Migration Plan

Frontend-only. Entries without `contentHeight` keep working through the legacy path, and storage is per tab. Rollback is reverting the change.

## Open Questions

- Is 10 s the right `RESERVE_MS`? It is easy to tune after trying it on the slowest list.
