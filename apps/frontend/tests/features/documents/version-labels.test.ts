import { describe, expect, test } from "bun:test"
import { versionLabel } from "@/features/documents/shared/definitions/document-labels"

describe("versionLabel", () => {
  test("names each version by its number and origin", () => {
    expect(versionLabel({ number: 1, kind: "upload" })).toBe(
      "v1\u00A0· original"
    )
    expect(versionLabel({ number: 1, kind: "merge" })).toBe(
      "v1\u00A0· unión de documentos"
    )
    expect(versionLabel({ number: 2, kind: "pages" })).toBe(
      "v2\u00A0· páginas editadas"
    )
    expect(versionLabel({ number: 3, kind: "signature" })).toBe(
      "v3\u00A0· firmada"
    )
  })
})
