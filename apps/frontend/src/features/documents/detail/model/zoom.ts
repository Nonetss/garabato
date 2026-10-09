/**
 * Zoom levels the viewer steps through, as a multiple of the fitted width
 * (the pane's width, capped at the reading column).
 */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const

/** The pages fill the reading column. */
export const FIT_ZOOM = 1

/** The next level up, or the same one at the top of the scale. */
export function zoomIn(zoom: number) {
  const next = ZOOM_STEPS.find((step) => step > zoom)
  if (next === undefined) return zoom
  return next
}

/** The next level down, or the same one at the bottom of the scale. */
export function zoomOut(zoom: number) {
  const next = ZOOM_STEPS.findLast((step) => step < zoom)
  if (next === undefined) return zoom
  return next
}

/** The zoom as a whole percentage, e.g. `125 %`. */
export function zoomPercent(zoom: number) {
  return `${Math.round(zoom * 100)} %`
}

/** A page's top edge relative to the scroll pane's visible top, and height. */
export type PageSpan = { top: number; height: number }

/** A point of the document, held as a page and how far down it (0–1). */
export type PageAnchor = { page: number; fraction: number }

/**
 * The point under `line` (relative to the pane's visible top), so a zoom can
 * keep it in place: the last page whose top is above the line, falling back
 * to the first.
 */
export function pageAnchor(
  pages: readonly PageSpan[],
  line: number
): PageAnchor | null {
  if (pages.length === 0) return null
  const page = Math.max(
    pages.findLastIndex((span) => span.top <= line),
    0
  )
  const span = pages[page]
  if (!span || span.height <= 0) return { page, fraction: 0 }
  const fraction = Math.min(Math.max((line - span.top) / span.height, 0), 1)
  return { page, fraction }
}

/**
 * How far to scroll the pane so the anchored point is back under `line`,
 * given the anchored page's span after the zoom.
 */
export function anchorShift(span: PageSpan, fraction: number, line: number) {
  return span.top + fraction * span.height - line
}

/** Accumulated ctrl+wheel delta that takes one zoom step. */
export const WHEEL_ZOOM_STEP = 50
