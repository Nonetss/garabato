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
  timeZone: "Europe/Madrid",
})

export type StampText = {
  signerName: string
  issuerName: string
  signingTime: Date
  reason?: string
  location?: string
}

/** The stamp copy, AutoFirma style. */
export function stampLines(text: StampText): string[] {
  const lines = [
    `Firmado digitalmente por ${text.signerName}`,
    `Fecha: ${DATE_FORMAT.format(text.signingTime)}`,
    `Emisor: ${text.issuerName}`,
  ]
  if (text.reason) lines.push(`Motivo: ${text.reason}`)
  if (text.location) lines.push(`Lugar: ${text.location}`)
  return lines
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

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []
  let current = ""
  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// Shrinks the font until every wrapped line fits inside the stamp.
function layout(lines: string[], font: PDFFont, width: number, height: number) {
  for (let size = 10; size > 4; size -= 0.5) {
    const wrapped = lines.flatMap((line) => wrap(line, font, size, width))
    if (wrapped.length * size * 1.2 <= height) return { size, wrapped }
  }
  return {
    size: 4,
    wrapped: lines.flatMap((line) => wrap(line, font, 4, width)),
  }
}

const PADDING = 4

/**
 * The stamp's appearance: a light box with the text, drawn in the displayed
 * orientation and turned by `/Matrix` to match the page rotation.
 */
export function appearanceStream(
  doc: PDFDocument,
  font: PDFFont,
  placement: WidgetPlacement,
  lines: string[]
): PDFRef {
  const { width, height } = placement
  const safeLines = lines.map((line) => encodable(font, line))
  const { size, wrapped } = layout(
    safeLines,
    font,
    width - PADDING * 2,
    height - PADDING * 2
  )
  const ops = [
    "q 0.94 0.96 1 rg",
    `0 0 ${width} ${height} re f`,
    "0.25 0.35 0.65 RG 0.8 w",
    `0.4 0.4 ${width - 0.8} ${height - 0.8} re S Q`,
    "BT 0.1 0.1 0.15 rg",
    `/F1 ${size} Tf ${size * 1.2} TL`,
    `${PADDING} ${height - PADDING - size} Td`,
    ...wrapped.map((line) => `${font.encodeText(line).toString()} Tj T*`),
    "ET",
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
