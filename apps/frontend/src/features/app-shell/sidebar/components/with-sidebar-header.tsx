import { useEffect, useRef } from "react"
import { usePathname } from "@/hooks/use-pathname"
import {
  type ScrollRestorationTarget,
  useElementScrollRestoration,
} from "@/hooks/use-scroll-restoration"
import { dispatchContentScroll } from "@/lib/content-scroll-event"

function findAppScroller(header: HTMLElement | null): HTMLElement | null {
  return (
    header?.closest<HTMLElement>("[data-app-scroller]") ??
    (typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("[data-app-scroller]"))
  )
}

function insetStorageKey(): string {
  return `app-shell-inset:${window.location.pathname}${window.location.search}`
}

/**
 * The current page's inset scroller and content wrapper, read from the
 * swapped DOM. `data-persist-scroll="false"` (`WithSidebar`
 * `persistScroll={false}`) starts at the top without saving.
 */
function resolveInsetTarget(): ScrollRestorationTarget | null {
  const scroller = document.querySelector<HTMLElement>("[data-app-scroller]")
  if (!scroller) return null
  const content = scroller.querySelector<HTMLElement>(
    ":scope > [data-app-scroll-content]"
  )
  if (scroller.dataset.persistScroll === "false") {
    return { scroller, content, resolveStorageKey: undefined }
  }
  return { scroller, content, resolveStorageKey: insetStorageKey }
}

/**
 * Persist island: top spacer of the inset scroller. Lives outside the fading
 * page slot so it does not remount on section navigations. The sidebar
 * toggle lives in the sidebar footer, not here. It saves and restores the
 * inset scroller offset; the restoration hook resolves the scroller again
 * on every swap because each navigation swaps `<main>`. Scroll persistence
 * is opted out per page via `data-persist-scroll` on the scroller
 * (`WithSidebar` `persistScroll={false}`), not as an island prop — persist
 * would freeze the first page's value.
 *
 * The site navbar is `fixed`, so a transparent spacer of `--navbar-height`
 * sits at the top of the scroller: at rest page content starts just below
 * the navbar; on scroll, it passes under the navbar. Scroll position is
 * forwarded via `dispatchContentScroll`.
 */
export function WithSidebarHeader() {
  const pathname = usePathname()
  const headerRef = useRef<HTMLDivElement>(null)

  useElementScrollRestoration(resolveInsetTarget)

  useEffect(() => {
    const node = findAppScroller(headerRef.current)
    if (!node) return

    const emit = () => dispatchContentScroll(node.scrollTop)
    emit()
    node.addEventListener("scroll", emit, { passive: true })
    document.addEventListener("astro:after-swap", emit)
    document.addEventListener("astro:page-load", emit)
    return () => {
      node.removeEventListener("scroll", emit)
      document.removeEventListener("astro:after-swap", emit)
      document.removeEventListener("astro:page-load", emit)
      dispatchContentScroll(0)
    }
  }, [pathname])

  return (
    <div ref={headerRef} className="sticky top-0 z-10 shrink-0">
      <div className="h-(--navbar-height)" aria-hidden />
    </div>
  )
}
