import { describe, expect, test } from "bun:test"
import {
  documentSearchDescription,
  folderSearchDescription,
  getSearchSourceSurfaces,
  surfaceRecordHref,
} from "@/features/app-shell/authenticated/model/surface-search-sources"

describe("document search source", () => {
  test("lists document records under the documents section", () => {
    const target = getSearchSourceSurfaces(false).find(
      ({ source }) => source === "documents"
    )
    expect(target?.surface.path).toBe("/documents/[id]")
    expect(target?.trail).toEqual(["Documentos"])
  })

  test("describes pages and signing status", () => {
    expect(documentSearchDescription({ pageCount: 1, signatureCount: 0 })).toBe(
      "1 página · Sin firmar"
    )
    expect(documentSearchDescription({ pageCount: 3, signatureCount: 2 })).toBe(
      "3 páginas · Firmado"
    )
  })
})

describe("document folder search source", () => {
  test("opens folders on the documents page", () => {
    const target = getSearchSourceSurfaces(false).find(
      ({ source }) => source === "document-folders"
    )
    expect(target?.surface.path).toBe("/documents")
    expect(target?.trail).toEqual(["Documentos"])
  })

  test("describes the parent path and document count", () => {
    expect(folderSearchDescription("", 1)).toBe("1 documento")
    expect(folderSearchDescription("Clientes / 2026", 3)).toBe(
      "Clientes / 2026 · 3 documentos"
    )
  })
})

describe("surfaceRecordHref", () => {
  test("fills path segments", () => {
    expect(
      surfaceRecordHref("/documents/[id]", { params: { id: "a b" } })
    ).toBe("/documents/a%20b")
  })

  test("appends the query to a concrete path", () => {
    expect(
      surfaceRecordHref("/documents", {
        params: {},
        query: { carpeta: "f/1" },
      })
    ).toBe("/documents?carpeta=f%2F1")
  })

  test("returns null when a segment has no value", () => {
    expect(
      surfaceRecordHref("/documents/[id]", { params: {}, query: { a: "1" } })
    ).toBeNull()
  })
})
