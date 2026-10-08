import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react"
import { createSimpleViewState, type createViewState } from "@/lib/view-state"

type ViewStateApi<TExtra extends object> = ReturnType<
  typeof createViewState<TExtra>
>

/**
 * Restores and persists a page's scroll position (and whatever extra state
 * its view-state tracks) across navigation. Defaults to `window` as the
 * scrolled element; pass `getScrollElement` for a page that scrolls an
 * inner container instead.
 */
export function useScrollRestoration<TExtra extends object>({
  viewState,
  ready = true,
  onRestore,
  getExtra = () => ({}) as TExtra,
  getScrollElement,
}: {
  viewState: ViewStateApi<TExtra>
  /** Defer restoring/persisting until the page's data has settled. */
  ready?: boolean
  /** Called once, when a saved view is restored, with the saved extra state. */
  onRestore?: (extra: TExtra) => void
  /** Read the current extra state to persist alongside scroll position. Omit for pages with no extra state. */
  getExtra?: () => TExtra
  getScrollElement?: () => HTMLElement | null
}) {
  const restoredRef = useRef(false)

  const scrollTo = useCallback(
    (top: number) => {
      const el = getScrollElement?.()
      if (el) el.scrollTop = top
      else window.scrollTo({ top, behavior: "auto" })
    },
    [getScrollElement]
  )

  const readScrollY = useCallback(
    () => getScrollElement?.()?.scrollTop ?? window.scrollY,
    [getScrollElement]
  )

  useLayoutEffect(() => {
    if (!ready || restoredRef.current) return
    restoredRef.current = true
    const saved = viewState.read()
    if (!saved) return

    onRestore?.(saved)

    const restore = () => scrollTo(saved.scrollY)
    restore()
    const frame = requestAnimationFrame(restore)
    const t1 = window.setTimeout(restore, 50)
    const t2 = window.setTimeout(restore, 200)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [ready, scrollTo, onRestore, viewState.read])

  useEffect(() => {
    if (!ready) return

    let frame = 0
    const persist = () => viewState.save(readScrollY(), getExtra())
    const schedulePersist = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        persist()
      })
    }

    const target = getScrollElement?.() ?? window
    persist()
    target.addEventListener("scroll", schedulePersist, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      target.removeEventListener("scroll", schedulePersist)
    }
  }, [ready, readScrollY, getScrollElement, viewState.save, getExtra])

  return {
    persist: (extra: TExtra) => viewState.save(readScrollY(), extra),
  }
}

const RESTORE_MS = 2500

/**
 * Restores an element's scrollTop across Astro View Transitions. When
 * `storageKey` is set, the offset is persisted in sessionStorage; when it
 * is omitted, the scroller still snaps to 0 (the same overflow container is
 * reused across sidebar pages, so a leftover offset from the previous route
 * would otherwise land the new page at the bottom) but nothing is saved.
 *
 * Restore keeps retrying while the content grows (nested islands, infinite
 * lists) and never overwrites a saved offset with 0 when the scroller is
 * swapped out from under us.
 */
export function useElementScrollRestoration(
  elementRef: RefObject<HTMLElement | null>,
  storageKey: string | undefined
) {
  const lastYRef = useRef(0)

  useLayoutEffect(() => {
    const el = elementRef.current
    if (!el) return

    const viewState = storageKey ? createSimpleViewState(storageKey) : null
    const saved = viewState?.read()?.scrollY ?? 0
    const target = Math.max(0, saved)
    lastYRef.current = target
    el.scrollTop = target
    let done = target <= 0
    let interval = 0

    const persist = (y: number) => {
      lastYRef.current = y
      viewState?.save(y, {})
    }

    const stopRestoring = () => {
      done = true
      resize.disconnect()
      mutations.disconnect()
      window.clearInterval(interval)
    }

    const restore = () => {
      if (done) return
      el.scrollTop = target
      if (Math.abs(el.scrollTop - target) <= 1) {
        persist(target)
        stopRestoring()
      }
    }

    const onScroll = () => {
      if (done) {
        persist(el.scrollTop)
        return
      }
      if (Math.abs(el.scrollTop - target) <= 1) {
        persist(target)
        stopRestoring()
        return
      }
      const max = Math.max(0, el.scrollHeight - el.clientHeight)
      // Content is still too short: restore clamped to the max and must
      // not clobber the saved offset with that temporary value.
      if (max < target - 1) return
      persist(el.scrollTop)
      stopRestoring()
    }

    // A restoration may still be waiting for async content to reach its saved
    // offset. Once the user operates anything inside the scroller, that
    // position is no longer authoritative. In particular, an accordion adds
    // its panel after its trigger is pressed; the mutation observer below must
    // not then pull the viewport back to the old offset.
    const onUserIntent = () => {
      if (!done) stopRestoring()
    }

    const resize = new ResizeObserver(restore)
    resize.observe(el)
    const mutations = new MutationObserver(restore)
    mutations.observe(el, { childList: true, subtree: true })
    interval = window.setInterval(restore, 50)
    const stop = window.setTimeout(() => {
      window.clearInterval(interval)
    }, RESTORE_MS)

    restore()
    el.addEventListener("scroll", onScroll, { passive: true })
    el.addEventListener("pointerdown", onUserIntent, { passive: true })
    el.addEventListener("keydown", onUserIntent)

    const beforeLeave = () => persist(lastYRef.current)
    document.addEventListener("astro:before-preparation", beforeLeave)
    document.addEventListener("astro:before-swap", beforeLeave)
    window.addEventListener("pagehide", beforeLeave)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(stop)
      resize.disconnect()
      mutations.disconnect()
      el.removeEventListener("scroll", onScroll)
      el.removeEventListener("pointerdown", onUserIntent)
      el.removeEventListener("keydown", onUserIntent)
      document.removeEventListener("astro:before-preparation", beforeLeave)
      document.removeEventListener("astro:before-swap", beforeLeave)
      window.removeEventListener("pagehide", beforeLeave)
      persist(lastYRef.current)
    }
  }, [elementRef, storageKey])
}
