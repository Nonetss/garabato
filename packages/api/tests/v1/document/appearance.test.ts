import { describe, expect, test } from "bun:test"
import { PDFDocument, type PDFFont, StandardFonts } from "@cantoo/pdf-lib"
import {
  breakOnlyNumbers,
  fitBlock,
  formatSigningTime,
  stampContent,
  wrapText,
} from "#v1/document/pades/appearance"

async function helvetica(): Promise<PDFFont> {
  const doc = await PDFDocument.create()
  return doc.embedFont(StandardFonts.Helvetica)
}

const NAME = "MORENO LOPEZ BARAJAS ANTONIO - 77225780Z"

describe("formatSigningTime", () => {
  test("uses Madrid time with its summer and winter abbreviation", () => {
    expect(formatSigningTime(new Date("2026-10-07T16:43:43Z"))).toBe(
      "2026-10-07 18:43:43 CEST"
    )
    expect(formatSigningTime(new Date("2026-01-07T16:43:43Z"))).toBe(
      "2026-01-07 17:43:43 CET"
    )
  })
})

describe("stampContent", () => {
  test("puts the name left and the Adobe-style details right", () => {
    const content = stampContent({
      signerName: NAME,
      signingTime: new Date("2026-10-07T16:43:43Z"),
      reason: "Conformidad",
      location: "Madrid",
    })

    expect(content.name).toBe(NAME)
    expect(content.details).toEqual([
      "Firmado por:",
      NAME,
      "Fecha:",
      "2026-10-07 18:43:43 CEST",
      "Motivo:",
      "Conformidad",
      "Lugar:",
      "Madrid",
    ])
  })
})

describe("wrapText", () => {
  test("keeps name words whole and breaks only the NIF", async () => {
    const font = await helvetica()
    const width = font.widthOfTextAtSize("BARAJAS", 20)

    const lines = wrapText(NAME, font, 20, width, breakOnlyNumbers)

    expect(lines).toContain("BARAJAS")
    expect(lines.join("")).toBe(NAME.replaceAll(" ", ""))
    expect(lines.some((line) => /^\d+$/.test(line))).toBe(true)
  })
})

describe("fitBlock", () => {
  test("picks the largest size whose lines fit the box", async () => {
    const font = await helvetica()
    const box = { width: 80, height: 100 }

    const block = fitBlock([NAME], font, box, 40, breakOnlyNumbers)

    expect(block.size).toBeGreaterThan(3)
    expect(block.lines.length * block.size * 1.15).toBeLessThanOrEqual(
      box.height
    )
    for (const line of block.lines) {
      expect(font.widthOfTextAtSize(line, block.size)).toBeLessThanOrEqual(
        box.width
      )
    }
  })

  test("falls back to the smallest size in a tiny box", async () => {
    const font = await helvetica()

    const block = fitBlock([NAME], font, { width: 10, height: 5 }, 40)

    expect(block.size).toBe(3)
  })
})
