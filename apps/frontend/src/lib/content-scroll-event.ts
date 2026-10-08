/** Custom event the inner app-shell scroller emits so chrome outside that
 *  container (the persisted navbar) can track scroll without reading
 *  `window.scrollY` — `hideFooter` layouts lock the document. */
export const CONTENT_SCROLL_EVENT = "app:content-scroll"

export function dispatchContentScroll(scrollTop: number) {
  document.dispatchEvent(
    new CustomEvent(CONTENT_SCROLL_EVENT, { detail: { scrollTop } })
  )
}

export function contentScrollTopFrom(event: Event): number | null {
  if (!(event instanceof CustomEvent)) return null
  const scrollTop = (event.detail as { scrollTop?: unknown } | undefined)
    ?.scrollTop
  return typeof scrollTop === "number" ? scrollTop : null
}
