import type { StampRect } from "@/features/documents/shared"

/** A point as fractions (0–1) of the displayed page, origin top-left. */
export type PagePoint = { x: number; y: number }

/** Smallest stamp the drag accepts: below this it is treated as a click. */
export const MIN_STAMP_FRACTION = 0.03

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

/** A pointer position relative to an element, as page fractions. */
export function pointIn(
  bounds: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number
): PagePoint {
  return {
    x: clamp((clientX - bounds.left) / bounds.width),
    y: clamp((clientY - bounds.top) / bounds.height),
  }
}

/** The rectangle spanned by a drag, whatever its direction. */
export function rectBetween(start: PagePoint, end: PagePoint): StampRect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

/** True when a drawn rectangle is big enough to hold a stamp. */
export function isUsableRect(rect: StampRect): boolean {
  return rect.width >= MIN_STAMP_FRACTION && rect.height >= MIN_STAMP_FRACTION
}

/** Percent-based CSS box for drawing a rectangle over a page. */
export function rectStyle(rect: StampRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  }
}

/** Width of a tapped stamp, as a fraction of the page width. */
export const TAP_STAMP_WIDTH = 0.3

/** A tapped stamp is this many times wider than tall on paper. */
export const TAP_STAMP_RATIO = 3

/** A touch that travels further than this (in page fractions) is a scroll. */
export const TAP_SLOP = 0.02

/**
 * The stamp a tap places: a standard-size rectangle centered on the point
 * and kept inside the page. `aspect` is the page's height over its width,
 * so the stamp keeps its paper proportions on any page shape.
 */
export function stampAt(point: PagePoint, aspect: number): StampRect {
  const width = TAP_STAMP_WIDTH
  const height = Math.min(1, width / TAP_STAMP_RATIO / aspect)
  return {
    x: Math.min(1 - width, Math.max(0, point.x - width / 2)),
    y: Math.min(1 - height, Math.max(0, point.y - height / 2)),
    width,
    height,
  }
}

/** True while a touch has stayed close enough to its start to be a tap. */
export function isTap(start: PagePoint, end: PagePoint): boolean {
  return (
    Math.abs(end.x - start.x) <= TAP_SLOP &&
    Math.abs(end.y - start.y) <= TAP_SLOP
  )
}
