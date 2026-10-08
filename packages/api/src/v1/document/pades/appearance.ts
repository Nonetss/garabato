import type { PDFDocument, PDFFont, PDFPage, PDFRef } from "@cantoo/pdf-lib"

/** Fractions (0–1) of the page as displayed, origin at its top-left. */
export type NormalizedRect = {
  x: number
  y: number
  width: number
  height: number
}

export type VisibleAppearance = {
  /** 0-based page the user drew the rectangle on. */
  page: number
  /** That page only, or the same relative position on every page. */
  pages: "one" | "all"
  rect: NormalizedRect
}

/** One stamp to draw: its page, its rectangle in the page's user space,
 *  and the page rotation the stamp must counter. */
export type WidgetPlacement = {
  pageIndex: number
  rect: [number, number, number, number]
  /** Displayed size of the stamp, before rotation. */
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
}

export class AppearanceError extends Error {}

const ROTATIONS = [0, 90, 180, 270] as const
type Rotation = (typeof ROTATIONS)[number]

function rotationOf(page: PDFPage): Rotation {
  const angle = ((page.getRotation().angle % 360) + 360) % 360
  const rotation = ROTATIONS.find((candidate) => candidate === angle)
  if (rotation === undefined) return 0
  return rotation
}

export function assertValidRect(rect: NormalizedRect) {
  const values = [rect.x, rect.y, rect.width, rect.height]
  if (!values.every(Number.isFinite)) {
    throw new AppearanceError("Rectangle values must be finite")
  }
  if (rect.width <= 0 || rect.height <= 0) {
    throw new AppearanceError("Rectangle has no area")
  }
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > 1) {
    throw new AppearanceError("Rectangle falls outside the page")
  }
  if (rect.y + rect.height > 1) {
    throw new AppearanceError("Rectangle falls outside the page")
  }
}

/**
 * Maps a point given as fractions of the displayed page (u right, v down
 * from the displayed top-left) to the page's unrotated user space. Pages
 * are displayed rotated clockwise by `/Rotate` and clipped to the crop box.
 */
function toUserSpace(page: PDFPage, rotation: Rotation, u: number, v: number) {
  const box = page.getCropBox()
  if (rotation === 90) {
    return { x: box.x + v * box.width, y: box.y + u * box.height }
  }
  if (rotation === 180) {
    return { x: box.x + (1 - u) * box.width, y: box.y + v * box.height }
  }
  if (rotation === 270) {
    return {
      x: box.x + (1 - v) * box.width,
      y: box.y + (1 - u) * box.height,
    }
  }
  return { x: box.x + u * box.width, y: box.y + (1 - v) * box.height }
}

function placementOn(
  page: PDFPage,
  pageIndex: number,
  rect: NormalizedRect
): WidgetPlacement {
  const rotation = rotationOf(page)
  const a = toUserSpace(page, rotation, rect.x, rect.y)
  const b = toUserSpace(
    page,
    rotation,
    rect.x + rect.width,
    rect.y + rect.height
  )
  const left = Math.min(a.x, b.x)
  const bottom = Math.min(a.y, b.y)
  const right = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  // Quarter turns swap the stamp's displayed width and height.
  const turned = rotation === 90 || rotation === 270
  const userWidth = right - left
  const userHeight = top - bottom
  const width = turned ? userHeight : userWidth
  const height = turned ? userWidth : userHeight
  return {
    pageIndex,
    rect: [left, bottom, right, top],
    width,
    height,
    rotation,
  }
}

/**
 * The stamps a visible signature needs: one on the chosen page, or one per
 * page at the same relative position (each page's own box and rotation).
 */
export function placeWidgets(
  pages: PDFPage[],
  appearance: VisibleAppearance
): WidgetPlacement[] {
  assertValidRect(appearance.rect)
  const reference = pages[appearance.page]
  if (!Number.isInteger(appearance.page) || !reference) {
    throw new AppearanceError(`Page ${appearance.page} does not exist`)
  }
  if (appearance.pages === "one") {
    return [placementOn(reference, appearance.page, appearance.rect)]
  }
  return pages.map((page, index) => placementOn(page, index, appearance.rect))
}

/** Rotates the stamp's content by the page rotation, counter-clockwise in
 *  user space, so it reads upright once the page turns clockwise. */
function matrixFor(rotation: Rotation): number[] {
  if (rotation === 90) return [0, 1, -1, 0, 0, 0]
  if (rotation === 180) return [-1, 0, 0, -1, 0, 0]
  if (rotation === 270) return [0, -1, 1, 0, 0, 0]
  return [1, 0, 0, 1, 0, 0]
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Madrid",
  timeZoneName: "short",
})

/** `2026-10-07 18:43:43 CEST`, as Adobe stamps it, in Europe/Madrid. */
export function formatSigningTime(date: Date): string {
  const parts = new Map(
    DATE_FORMAT.formatToParts(date).map((part) => [part.type, part.value])
  )
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.get(type) ?? ""
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")} ${part("timeZoneName")}`
}

export type StampText = {
  signerName: string
  signingTime: Date
  reason?: string
  location?: string
}

/** What the stamp shows: the name, big, on the left; the details, small,
 *  on the right. Each detail is a paragraph that may wrap. */
export type StampContent = {
  name: string
  details: string[]
}

/** The stamp copy, laid out like Adobe's default signature appearance. */
export function stampContent(text: StampText): StampContent {
  const details = [
    "Firmado por:",
    text.signerName,
    "Fecha:",
    formatSigningTime(text.signingTime),
  ]
  if (text.reason) details.push("Motivo:", text.reason)
  if (text.location) details.push("Lugar:", text.location)
  return { name: text.signerName, details }
}

// Standard fonts only encode WinAnsi; anything else becomes "?" rather than
// failing the signature.
function encodable(font: PDFFont, text: string) {
  let result = ""
  for (const char of text) {
    try {
      font.encodeText(char)
      result += char
    } catch {
      result += "?"
    }
  }
  return result
}

// Splits a word wider than the column into pieces that fit, the way the
// NIF in "77225780" / "Z" breaks in Adobe's stamp.
function breakWord(word: string, font: PDFFont, size: number, width: number) {
  const pieces: string[] = []
  let current = ""
  for (const char of word) {
    const candidate = current + char
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      pieces.push(current)
      current = char
    } else {
      current = candidate
    }
  }
  if (current) pieces.push(current)
  return pieces
}

/** Which words may be split across lines when they do not fit whole. */
export type BreakRule = (word: string) => boolean

/** Any word may break: the details column. */
export const breakAnything: BreakRule = () => true

/** Only tokens with digits (the NIF) break, like Adobe's stamp; name words
 *  stay whole and the font shrinks instead. */
export const breakOnlyNumbers: BreakRule = (word) => /\d/.test(word)

/**
 * Greedy word wrap. A word wider than the column breaks into pieces when
 * `canBreak` allows it; otherwise it stays whole on its own (overflowing)
 * line, which `fitBlock` then rejects.
 */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
  canBreak: BreakRule = breakAnything
): string[] {
  const lines: string[] = []
  let current = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    if (!canBreak(word)) {
      current = word
      continue
    }
    const pieces = breakWord(word, font, size, width)
    current = pieces.pop() ?? ""
    lines.push(...pieces)
  }
  if (current) lines.push(current)
  return lines
}

const LINE_HEIGHT = 1.15
const MAX_NAME_SIZE = 40
const MAX_DETAILS_SIZE = 12
const MIN_SIZE = 3

type Block = { size: number; lines: string[] }

// The largest font size, in half points, whose wrapped paragraphs fit the
// box; a stamp too small for anything readable falls back to MIN_SIZE.
export function fitBlock(
  paragraphs: string[],
  font: PDFFont,
  box: { width: number; height: number },
  maxSize: number,
  canBreak: BreakRule = breakAnything
): Block {
  const wrapAll = (size: number, rule: BreakRule) =>
    paragraphs.flatMap((text) => wrapText(text, font, size, box.width, rule))
  for (let size = maxSize; size > MIN_SIZE; size -= 0.5) {
    const lines = wrapAll(size, canBreak)
    const fitsHeight = lines.length * size * LINE_HEIGHT <= box.height
    const fitsWidth = lines.every(
      (line) => font.widthOfTextAtSize(line, size) <= box.width
    )
    if (fitsHeight && fitsWidth) return { size, lines }
  }
  // Too small for whole words: break anything at the smallest size.
  return { size: MIN_SIZE, lines: wrapAll(MIN_SIZE, breakAnything) }
}

// Text operators for a block vertically centred in its column; each line
// left-aligned, or centred when `centred` is set.
function blockOps(
  font: PDFFont,
  block: Block,
  column: { x: number; width: number; height: number },
  centred: boolean
) {
  const leading = block.size * LINE_HEIGHT
  const blockHeight = block.lines.length * leading
  // Baseline of the first line: centre the block, then drop one ascent.
  const top = (column.height + blockHeight) / 2
  return block.lines.map((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, block.size)
    const indent = centred ? (column.width - lineWidth) / 2 : 0
    const x = column.x + Math.max(0, indent)
    const y = top - leading * index - block.size
    return `BT /F1 ${block.size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${font.encodeText(line).toString()} Tj ET`
  })
}

const PADDING = 2
const GUTTER = 8

/**
 * The stamp's appearance, after Adobe's default: no box, the signer's name
 * as large as it fits on the left half, centred line by line, and the
 * "Firmado por / Fecha" details small on the right half. It is drawn in the
 * displayed orientation and turned by `/Matrix` to match the page rotation.
 */
export function appearanceStream(
  doc: PDFDocument,
  font: PDFFont,
  placement: WidgetPlacement,
  content: StampContent
): PDFRef {
  const { width, height } = placement
  const inner = height - PADDING * 2
  const columnWidth = (width - PADDING * 2 - GUTTER) / 2
  const box = { width: columnWidth, height: inner }
  const name = fitBlock(
    [encodable(font, content.name)],
    font,
    box,
    MAX_NAME_SIZE,
    breakOnlyNumbers
  )
  const details = fitBlock(
    content.details.map((text) => encodable(font, text)),
    font,
    box,
    MAX_DETAILS_SIZE
  )
  const ops = [
    "q 0 0 0 rg",
    ...blockOps(font, name, { x: PADDING, width: columnWidth, height }, true),
    ...blockOps(
      font,
      details,
      { x: PADDING + columnWidth + GUTTER, width: columnWidth, height },
      false
    ),
    "Q",
  ]
  const stream = doc.context.flateStream(ops.join("\n"), {
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, width, height],
    Matrix: matrixFor(placement.rotation),
    Resources: { Font: { F1: font.ref } },
  })
  return doc.context.register(stream)
}
