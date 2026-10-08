import { useLayoutEffect } from "react"
import { createViewState } from "@/lib/view-state"

/** How long a restored page keeps its saved content height reserved while
 *  its islands load and fetch. Past it, a page that is now shorter clamps. */
export const RESERVE_MS = 10_000

export type ScrollRestorationTarget = {
  /** The element that scrolls. */
  scroller: HTMLElement
  /** The scroller's content wrapper, which takes the reserved height.
   *  `null` restores the offset without reserving. */
  content: HTMLElement | null
  /** Resolves the sessionStorage key. `undefined` starts at the top and
   *  saves nothing. */
  resolveStorageKey: (() => string) | undefined
}

function readContentHeight(value: unknown): number | null {
  if (typeof value !== "number") return null
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function createScrollViewState(storageKey: string) {
  return createViewState<{ contentHeight: number | null }>(
    storageKey,
    (raw) => ({ contentHeight: readContentHeight(raw.contentHeight) })
  )
}

/** The laid-out boxes directly under `el`, descending through
 *  `display: contents` wrappers (`astro-island`), which have no box. */
function contentBoxes(el: Element): Element[] {
  const boxes: Element[] = []
  for (const child of el.children) {
    if (getComputedStyle(child).display === "contents") {
      boxes.push(...contentBoxes(child))
      continue
    }
    boxes.push(child)
  }
  return boxes
}

function paddingBottom(el: Element): number {
  const value = Number.parseFloat(getComputedStyle(el).paddingBottom)
  if (Number.isFinite(value)) return value
  return 0
}

/**
 * The height `content`'s own children take up, plus its bottom padding.
 * Measured from the children rather than by clearing `min-height`: reading
 * the wrapper without its reservation forces a layout that would clamp the
 * scroller's offset in the middle of a restore.
 */
export function measureContentHeight(content: HTMLElement): number {
  const top = content.getBoundingClientRect().top
  let bottom = top
  for (const box of contentBoxes(content)) {
    bottom = Math.max(bottom, box.getBoundingClientRect().bottom)
  }
  return bottom - top + paddingBottom(content)
}

function reservedHeight(
  contentHeight: number | null,
  target: number,
  content: HTMLElement | null
): number {
  if (!content || target <= 0) return 0
  if (contentHeight === null) return 0
  return contentHeight
}

/**
 * One page's restoration: applies the saved offset to `scroller` and keeps
 * saving it until the returned stop function runs.
 *
 * The saved state is the offset plus the content height. Restoring reserves
 * that height as the content wrapper's `min-height` before writing
 * `scrollTop`, so the offset applies at once even though the page's islands
 * have not rendered yet. The reservation is released when the content
 * reaches it, when the user presses a pointer or key in the scroller, after
 * `RESERVE_MS`, or when the page stops. Wheel and touch scrolling keep it, so
 * the user can scroll through space whose content is still arriving. State
 * saved without a height applies its offset once, without a reservation.
 *
 * The key is resolved again on each save while the page is current, so a
 * `history.replaceState` change made elsewhere (e.g. a filter change) is
 * picked up. Once a navigation starts (`popstate`,
 * `astro:before-preparation`) the key is frozen: `location` is about to
 * point at the destination, and resolving it would store this page's offset
 * under the next page's key.
 */
function startScrollRestoration({
  scroller,
  content,
  resolveStorageKey,
}: ScrollRestorationTarget): () => void {
  if (!resolveStorageKey) {
    scroller.scrollTop = 0
    return () => {}
  }

  let key = resolveStorageKey()
  let leaving = false
  const currentKey = () => {
    if (!leaving) key = resolveStorageKey()
    return key
  }

  const saved = createScrollViewState(key).read()
  const target = Math.max(0, saved?.scrollY ?? 0)
  const reserved = reservedHeight(saved?.contentHeight ?? null, target, content)
  let reserving = reserved > 0
  let lastY = target
  let lastHeight = reserved
  let frame = 0

  const currentHeight = () => {
    if (!content?.isConnected) return lastHeight
    const natural = measureContentHeight(content)
    if (reserving) return Math.max(natural, reserved)
    return natural
  }

  const persist = (y: number) => {
    lastY = y
    lastHeight = currentHeight()
    createScrollViewState(currentKey()).save(y, { contentHeight: lastHeight })
  }

  const check = () => {
    frame = 0
    if (!content || !reserving) return
    for (const box of contentBoxes(content)) resize.observe(box)
    if (measureContentHeight(content) >= reserved - 1) release()
  }
  const scheduleCheck = () => {
    if (frame === 0) frame = window.requestAnimationFrame(check)
  }

  const resize = new ResizeObserver(scheduleCheck)
  const mutations = new MutationObserver(scheduleCheck)
  let timeout = 0

  function release() {
    if (!reserving) return
    reserving = false
    if (content) content.style.minHeight = ""
    resize.disconnect()
    mutations.disconnect()
    window.clearTimeout(timeout)
    window.cancelAnimationFrame(frame)
    frame = 0
  }

  if (reserving && content) {
    content.style.minHeight = `${reserved}px`
    mutations.observe(content, { childList: true, subtree: true })
    timeout = window.setTimeout(release, RESERVE_MS)
    check()
  }
  scroller.scrollTop = target

  const onScroll = () => {
    // Scroll events fired while the next page swaps in are not the user:
    // they must not overwrite this page's saved offset.
    if (leaving) return
    persist(scroller.scrollTop)
  }
  // Once the user operates anything in the scroller, the reserved space is
  // no longer theirs to keep: a filter change scrolls to the top and must
  // not leave empty space below the new result.
  const onUserIntent = () => release()
  const beforeLeave = () => {
    leaving = true
    persist(lastY)
  }
  const onPopState = () => {
    leaving = true
  }
  // A reload keeps the URL, so the key may still be resolved.
  const onPageHide = () => persist(lastY)

  scroller.addEventListener("scroll", onScroll, { passive: true })
  scroller.addEventListener("pointerdown", onUserIntent, { passive: true })
  scroller.addEventListener("keydown", onUserIntent)
  window.addEventListener("popstate", onPopState)
  document.addEventListener("astro:before-preparation", beforeLeave)
  document.addEventListener("astro:before-swap", beforeLeave)
  window.addEventListener("pagehide", onPageHide)

  return () => {
    persist(lastY)
    release()
    scroller.removeEventListener("scroll", onScroll)
    scroller.removeEventListener("pointerdown", onUserIntent)
    scroller.removeEventListener("keydown", onUserIntent)
    window.removeEventListener("popstate", onPopState)
    document.removeEventListener("astro:before-preparation", beforeLeave)
    document.removeEventListener("astro:before-swap", beforeLeave)
    window.removeEventListener("pagehide", onPageHide)
  }
}

function startFor(target: ScrollRestorationTarget | null): () => void {
  if (!target) return () => {}
  return startScrollRestoration(target)
}

/**
 * Restores a scroller's offset across Astro View Transitions for a hook
 * mounted outside the swapped content (a `transition:persist` island).
 * `resolveTarget` is read at mount (first load, reload) and again
 * synchronously on every `astro:after-swap`, which runs inside the view
 * transition's update callback: the swapped-in page is first painted at its
 * restored offset, not at the top. `null` means the page has nothing to
 * restore. Keep `resolveTarget` stable: a new identity restarts the page's
 * restoration.
 */
export function useElementScrollRestoration(
  resolveTarget: () => ScrollRestorationTarget | null
) {
  useLayoutEffect(() => {
    let stop = startFor(resolveTarget())
    const onAfterSwap = () => {
      stop()
      stop = startFor(resolveTarget())
    }
    document.addEventListener("astro:after-swap", onAfterSwap)
    return () => {
      document.removeEventListener("astro:after-swap", onAfterSwap)
      stop()
    }
  }, [resolveTarget])
}
