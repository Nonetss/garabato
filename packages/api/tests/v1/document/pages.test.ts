import { describe, expect, test } from "bun:test"
import { degrees, PDFDocument, PDFName, PDFString } from "@cantoo/pdf-lib"
import { pdfFixture } from "#tests/fixtures/document-files"
import { signedPdf } from "#tests/fixtures/signed-documents"
import {
  assertPageList,
  hasEmbeddedSignature,
  mergePdfs,
  type PageEdit,
  PageListError,
  rewritePages,
} from "#v1/document/pages"

/**
 * A PDF whose pages are told apart by their width, each holding an indirect
 * marker string only that page references.
 */
async function pdfOfWidths(widths: number[], rotations: number[] = []) {
  const doc = await PDFDocument.create()
  doc.setTitle("Contrato de prueba")
  for (const [index, width] of widths.entries()) {
    const page = doc.addPage([width, 500])
    page.setRotation(degrees(rotations[index] ?? 0))
    page.node.set(
      PDFName.of("GarabatoMarker"),
      doc.context.register(PDFString.of(`marker-page-${index + 1}`))
    )
  }
  return new Uint8Array(await doc.save({ useObjectStreams: false }))
}

async function pagesOf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes)
  return doc.getPages().map((page) => ({
    width: page.getWidth(),
    rotation: page.getRotation().angle,
  }))
}

function contains(bytes: Uint8Array, text: string) {
  return Buffer.from(bytes).includes(Buffer.from(text, "latin1"))
}

function pageListMessage(list: PageEdit[], pageCount: number) {
  try {
    assertPageList(list, pageCount)
  } catch (error) {
    if (error instanceof PageListError) return error.message
    throw error
  }
  return null
}

describe("assertPageList", () => {
  test("accepts a reorder, a rotation or a removal", () => {
    expect(
      pageListMessage(
        [
          { page: 1, rotation: 0 },
          { page: 0, rotation: 0 },
        ],
        2
      )
    ).toBeNull()
    expect(
      pageListMessage(
        [
          { page: 0, rotation: 90 },
          { page: 1, rotation: 0 },
        ],
        2
      )
    ).toBeNull()
    expect(pageListMessage([{ page: 1, rotation: 0 }], 2)).toBeNull()
  })

  test.each([
    ["an empty list", [], "al menos una página"],
    ["a page out of range", [{ page: 2, rotation: 0 }], "no tiene página 3"],
    ["a negative page", [{ page: -1, rotation: 0 }], "no tiene página 0"],
    [
      "a page named twice",
      [
        { page: 0, rotation: 0 },
        { page: 0, rotation: 90 },
      ],
      "aparece dos veces",
    ],
    [
      "a list that changes nothing",
      [
        { page: 0, rotation: 0 },
        { page: 1, rotation: 0 },
      ],
      "No hay cambios",
    ],
  ] satisfies [string, PageEdit[], string][])(
    "rejects %s",
    (_, list, message) => {
      expect(pageListMessage(list, 2)).toContain(message)
    }
  )
})

describe("rewritePages", () => {
  test("reorders, rotates on top of the page's rotation and removes", async () => {
    const source = await pdfOfWidths([100, 200, 300, 400], [0, 90, 0, 0])

    const result = await rewritePages(source, [
      { page: 2, rotation: 0 },
      { page: 1, rotation: 270 },
      { page: 0, rotation: 90 },
    ])

    expect(await pagesOf(result)).toEqual([
      { width: 300, rotation: 0 },
      { width: 200, rotation: 0 },
      { width: 100, rotation: 90 },
    ])
  })

  test("drops the objects of removed pages from the file", async () => {
    const source = await pdfOfWidths([100, 200, 300])
    expect(contains(source, "marker-page-2")).toBe(true)

    const result = await rewritePages(source, [
      { page: 0, rotation: 0 },
      { page: 2, rotation: 0 },
    ])

    expect(contains(result, "marker-page-1")).toBe(true)
    expect(contains(result, "marker-page-2")).toBe(false)
    expect(contains(result, "marker-page-3")).toBe(true)
  })

  test("keeps the catalog's metadata", async () => {
    const source = await pdfOfWidths([100, 200])

    const result = await rewritePages(source, [{ page: 1, rotation: 0 }])

    const doc = await PDFDocument.load(result)
    expect(doc.getTitle()).toBe("Contrato de prueba")
  })

  test("rewrites a fixture with object streams", async () => {
    const source = await pdfFixture("rotated")

    const result = await rewritePages(source, [
      { page: 1, rotation: 90 },
      { page: 0, rotation: 0 },
    ])

    const pages = await pagesOf(result)
    expect(pages.map((page) => page.rotation)).toEqual([180, 0])
  })

  test("refuses an invalid list", async () => {
    const source = await pdfOfWidths([100, 200])

    await expect(rewritePages(source, [])).rejects.toBeInstanceOf(PageListError)
  })
})

describe("mergePdfs", () => {
  test("concatenates every page in order, keeping rotations", async () => {
    const first = await pdfOfWidths([100, 200], [0, 90])
    const second = await pdfOfWidths([300])

    const merged = await mergePdfs([second, first])

    expect(await pagesOf(merged)).toEqual([
      { width: 300, rotation: 0 },
      { width: 100, rotation: 0 },
      { width: 200, rotation: 90 },
    ])
  })
})

describe("hasEmbeddedSignature", () => {
  test("sees a signature made by garabato", async () => {
    expect(await hasEmbeddedSignature(await signedPdf())).toBe(true)
  })

  test("finds none in an unsigned PDF", async () => {
    expect(await hasEmbeddedSignature(await pdfFixture("plain"))).toBe(false)
  })
})
