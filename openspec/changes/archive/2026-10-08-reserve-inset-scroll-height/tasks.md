## 1. Layout hook-up

- [x] 1.1 In `apps/frontend/src/layouts/WithSidebar.astro`, mark the page slot wrapper with `data-app-scroll-content`, add `[overflow-anchor:none]` to `<main data-app-scroller>`, and update the `persistScroll` doc comment to the reservation model
- [x] 1.2 In `with-sidebar-header.tsx`, replace the ref plus pathname key with a module-level resolver that reads the scroller, its `:scope > [data-app-scroll-content]` wrapper and `data-persist-scroll` from the DOM, and returns a storage key resolver for `app-shell-inset:<pathname><search>` (none when `"false"`). Leave the `dispatchContentScroll` effect as it is

## 2. Restoration model

- [x] 2.1 In `apps/frontend/src/hooks/use-scroll-restoration.ts`, export the `ScrollRestorationTarget` type and switch the saved state to `{ scrollY, contentHeight }` through `createViewState`, with `contentHeight` optional on read so legacy entries still parse
- [x] 2.2 Add `measureContentHeight`: the lowest laid-out child's bottom minus the wrapper's top, plus its bottom padding, descending through `display: contents` children, read without touching `min-height`. Use it for saving and for the release check; while reserving, save the larger of the measure and the reservation
- [x] 2.3 Replace the retry loop (observers on the scroller, 50 ms interval, `RESTORE_MS`) with: set `min-height` on the wrapper, then `scrollTop` once. Legacy entries apply `scrollTop` once with no reservation; a target without a storage key snaps to 0 and saves nothing
- [x] 2.4 Implement the release rules: content reaches the reservation (`ResizeObserver` on the wrapper's children plus a `MutationObserver` for new children, checked in an animation frame), `pointerdown`/`keydown` in the scroller, the restoration stopping (swap-out or unmount, not navigation start), and an exported `RESERVE_MS = 10000`. Wheel and touch scrolling do not release
- [x] 2.5 Change `useElementScrollRestoration` to take `resolveTarget`, start a restoration in its layout effect and again synchronously on `astro:after-swap` (stopping the previous one first), and clean up on unmount
- [x] 2.6 Keep the save contract: the key is re-resolved on each save while the page is current and frozen on `popstate` or `astro:before-preparation`; saves happen on user scrolls, `astro:before-preparation`, `astro:before-swap`, `pagehide` and stop; scroll events after the freeze are ignored. Rewrite the hook's doc comments for the new model
- [x] 2.7 Remove the unused window-based `useScrollRestoration` and the `createSimpleViewState` import if nothing else in the file needs it
- [x] 2.8 Add `apps/frontend/tests/hooks/use-scroll-restoration.test.tsx` (stubbing `getBoundingClientRect` and a clamping `scrollTop`, with fake timers) covering: reserve and apply the offset at once while the content is empty; release when the content arrives with the offset unchanged; release and clamp after `RESERVE_MS` when the content is shorter; release on `pointerdown`; no release on wheel scrolling; no reservation for a target without a key or for legacy entries; per path plus query keys; the saved key does not move to the next URL once navigation starts; restart on `astro:after-swap`. Run `bun run test`

## 3. Docs and validation

- [x] 3.1 Document `persistScroll` and the height reservation in `.agents/skills/stack/references/frontend/navigation-and-layouts.md`
- [x] 3.2 Run `check-types`, Biome on the changed files and `bun run tailwind:check`
- [x] 3.3 Ask the user to confirm in the browser: going back to a deep list with slow data shows the saved offset without a top frame, a filter click during the reservation leaves no gap, and filtered and unfiltered views of a list keep their own offsets
