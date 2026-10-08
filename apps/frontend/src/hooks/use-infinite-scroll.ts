import { useEffect, useRef } from "react"

/**
 * Fires `onIntersect` when the sentinel enters `root`'s viewport, so a list
 * can load its next page as the user scrolls an inner container. Pass `null`
 * for `root` when the page itself has no bounded inner scroll container of
 * its own — e.g. under `WithSidebar`, the inset already owns the scroll
 * region, so there's no separate inner box to observe against; `null`
 * falls back to the browser viewport, which the spec still clips correctly
 * against that ancestor's `overflow-y-auto`.
 */
export function useInfiniteScroll(
  root: HTMLDivElement | null,
  onIntersect: () => void,
  enabled: boolean
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !enabled) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect()
      },
      { root, rootMargin: "200px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [root, onIntersect, enabled])

  return sentinelRef
}
