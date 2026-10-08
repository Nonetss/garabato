import { describe, expect, test } from "bun:test"
import {
  emptyLibraryFilters,
  facetCounts,
  filterDocuments,
  isFiltering,
  type LibraryFilters,
  orderDocuments,
  STATUS_OPTIONS,
} from "@/features/documents/overview/model/library-filters"
import type { DocumentSummary } from "@/features/documents/shared/model/types"

function document(
  id: string,
  overrides: Partial<DocumentSummary> = {}
): DocumentSummary {
  return {
    id,
    name: `${id}.pdf`,
    pageCount: 1,
    sizeBytes: 100,
    versionCount: 1,
    signatureCount: 0,
    lastSignedAt: null,
    folderId: null,
    tagIds: [],
    pinnedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const library = [
  document("nomina-enero", {
    name: "Nómina enero.pdf",
    folderId: "rrhh",
    tagIds: ["clientes"],
    signatureCount: 1,
  }),
  document("nomina-febrero", {
    name: "nomina febrero.pdf",
    folderId: "archivo",
    tagIds: ["clientes", "archivado"],
  }),
  document("contrato", {
    name: "Contrato.pdf",
    tagIds: ["urgente"],
    pinnedAt: "2026-02-01T00:00:00.000Z",
  }),
]

const ids = (documents: DocumentSummary[]) => documents.map((d) => d.id)

function withFilters(overrides: Partial<LibraryFilters>): LibraryFilters {
  return { ...emptyLibraryFilters(), ...overrides }
}

describe("isFiltering", () => {
  test("is off with no filter and with only spaces typed", () => {
    expect(isFiltering(emptyLibraryFilters())).toBe(false)
    expect(isFiltering(withFilters({ query: "  " }))).toBe(false)
  })

  test("is on with text or any facet option", () => {
    expect(isFiltering(withFilters({ query: "nómina" }))).toBe(true)
    expect(
      isFiltering(withFilters({ pin: { include: ["pinned"], exclude: [] } }))
    ).toBe(true)
  })
})

describe("filterDocuments", () => {
  test("searches names in every folder, ignoring case and accents", () => {
    expect(
      ids(filterDocuments(library, withFilters({ query: "NOMINA" })))
    ).toEqual(["nomina-enero", "nomina-febrero"])
  })

  test("includes any chosen tag and excludes the excluded ones", () => {
    const filters = withFilters({
      tags: { include: ["clientes"], exclude: ["archivado"] },
    })
    expect(ids(filterDocuments(library, filters))).toEqual(["nomina-enero"])
  })

  test("filters by signing and pin state", () => {
    expect(
      ids(
        filterDocuments(
          library,
          withFilters({ status: { include: ["unsigned"], exclude: [] } })
        )
      )
    ).toEqual(["nomina-febrero", "contrato"])
    expect(
      ids(
        filterDocuments(
          library,
          withFilters({ pin: { include: ["pinned"], exclude: [] } })
        )
      )
    ).toEqual(["contrato"])
  })

  test("returns everything without filters", () => {
    expect(filterDocuments(library, emptyLibraryFilters())).toHaveLength(3)
  })
})

describe("facetCounts", () => {
  test("counts each option given the other filters", () => {
    const filters = withFilters({ query: "nomina" })
    const counts = facetCounts(library, filters, "status", STATUS_OPTIONS)
    expect(Object.fromEntries(counts)).toEqual({ signed: 1, unsigned: 1 })
  })

  test("ignores the dimension's own selection", () => {
    const filters = withFilters({
      tags: { include: ["urgente"], exclude: [] },
    })
    const counts = facetCounts(library, filters, "tags", [
      "clientes",
      "urgente",
      "archivado",
    ])
    expect(Object.fromEntries(counts)).toEqual({
      clientes: 2,
      urgente: 1,
      archivado: 1,
    })
  })
})

describe("orderDocuments", () => {
  test("puts pinned documents first, then the newest", () => {
    const ordered = orderDocuments([
      document("old", { createdAt: "2026-01-01T00:00:00.000Z" }),
      document("new", { createdAt: "2026-03-01T00:00:00.000Z" }),
      document("pinned-early", {
        createdAt: "2025-01-01T00:00:00.000Z",
        pinnedAt: "2026-02-01T00:00:00.000Z",
      }),
      document("pinned-late", {
        createdAt: "2025-01-01T00:00:00.000Z",
        pinnedAt: "2026-02-05T00:00:00.000Z",
      }),
    ])
    expect(ids(ordered)).toEqual(["pinned-late", "pinned-early", "new", "old"])
  })
})
