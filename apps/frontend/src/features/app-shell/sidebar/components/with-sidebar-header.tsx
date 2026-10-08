import { useEffect, useRef } from "react"
import { usePathname } from "@/hooks/use-pathname"
import { useElementScrollRestoration } from "@/hooks/use-scroll-restoration"
import { dispatchContentScroll } from "@/lib/content-scroll-event"

function findAppScroller(header: HTMLElement | null): HTMLElement | null {
  return (
    header?.closest<HTMLElement>("[data-app-scroller]") ??
    (typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("[data-app-scroller]"))
  )
}

function scrollStorageKey(
  pathname: string,
  scroller: HTMLElement | null
): string | undefined {
  if (scroller?.dataset.persistScroll === "false") return undefined
  return `app-shell-inset:${pathname}`
}

/**
 * Persist island: top spacer of the inset scroller. Lives outside the fading
 * page slot so it does not remount on section navigations. The sidebar
 * toggle lives in the sidebar footer, not here. Scroll
 * persistence is opted out per page via `data-persist-scroll` on the
 * scroller (`WithSidebar` `persistScroll={false}`), not as an island prop
 * — persist would freeze the first page's value.
 *
 * The site navbar is `fixed`, so a transparent spacer of `--navbar-height`
 * sits at the top of the scroller: at rest page content starts just below
 * the navbar; on scroll, it passes under the navbar. Scroll position is
 * forwarded via `dispatchContentScroll`.
 */
export function WithSidebarHeader() {
  const pathname = usePathname()
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const scroller = findAppScroller(headerRef.current)
  scrollerRef.current = scroller

  useElementScrollRestoration(scrollerRef, scrollStorageKey(pathname, scroller))

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
