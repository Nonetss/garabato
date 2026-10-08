/** Fraction of the scroll pane's height a page's top must pass to be current. */
export const CURRENT_PAGE_PROBE = 0.4

/**
 * The page the reader is on: the last one whose top edge has scrolled above
 * the probe line, or the last page once the pane can't scroll any further
 * (a short final page never reaches the probe).
 *
 * `tops` are each page's top edge relative to the pane's visible top, in
 * document order.
 */
export function currentPageIndex(
  tops: readonly number[],
  probe: number,
  atEnd: boolean
) {
  if (tops.length === 0) return 0
  if (atEnd) return tops.length - 1
  return Math.max(
    tops.findLastIndex((top) => top <= probe),
    0
  )
}

/** Clamps a requested page index into the document's range. */
export function clampPageIndex(index: number, count: number) {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0))
}
