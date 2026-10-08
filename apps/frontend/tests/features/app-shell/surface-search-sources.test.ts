import { describe, expect, test } from "bun:test"
import {
  documentSearchDescription,
  getSearchSourceSurfaces,
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
