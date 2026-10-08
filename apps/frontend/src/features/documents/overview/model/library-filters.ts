import type { DocumentSummary } from "@/features/documents/shared/model/types"
import { foldText } from "@/lib/fold-text"

/** Included and excluded options of one categorical filter. */
export type FacetSelection = { include: string[]; exclude: string[] }

export type LibraryFilters = {
  /** Text the document name contains, ignoring case and accents. */
  query: string
  /** Tag ids. */
  tags: FacetSelection
  /** `signed` / `unsigned`. */
  status: FacetSelection
  /** `pinned` / `unpinned`. */
  pin: FacetSelection
}

export type FacetDimension = "tags" | "status" | "pin"

export const STATUS_OPTIONS = ["signed", "unsigned"] as const
export const PIN_OPTIONS = ["pinned", "unpinned"] as const

const emptyFacet = (): FacetSelection => ({ include: [], exclude: [] })

export function emptyLibraryFilters(): LibraryFilters {
  return {
    query: "",
    tags: emptyFacet(),
    status: emptyFacet(),
    pin: emptyFacet(),
  }
}

function facetActive(facet: FacetSelection) {
  return facet.include.length + facet.exclude.length > 0
}

/** Whether any filter is set: the page then searches the whole library. */
export function isFiltering(filters: LibraryFilters) {
  return (
    filters.query.trim() !== "" ||
    facetActive(filters.tags) ||
    facetActive(filters.status) ||
    facetActive(filters.pin)
  )
}

/** The option values a document has in a dimension. */
function valuesOf(
  document: DocumentSummary,
  dimension: FacetDimension
): string[] {
  if (dimension === "tags") return document.tagIds
  if (dimension === "status") {
    if (document.signatureCount > 0) return ["signed"]
    return ["unsigned"]
  }
  if (document.pinnedAt !== null) return ["pinned"]
  return ["unpinned"]
}

// At least one included option (when any is included), no excluded one.
function matchesFacet(values: string[], facet: FacetSelection) {
  if (facet.exclude.some((option) => values.includes(option))) return false
  if (facet.include.length === 0) return true
  return facet.include.some((option) => values.includes(option))
}

const DIMENSIONS: FacetDimension[] = ["tags", "status", "pin"]

/** Whether `document` matches every filter, except `skip` if given. */
function matches(
  document: DocumentSummary,
  filters: LibraryFilters,
  skip?: FacetDimension
) {
  const query = foldText(filters.query.trim())
  if (query !== "" && !foldText(document.name).includes(query)) return false
  return DIMENSIONS.every(
    (dimension) =>
      dimension === skip ||
      matchesFacet(valuesOf(document, dimension), filters[dimension])
  )
}

export function filterDocuments(
  documents: DocumentSummary[],
  filters: LibraryFilters
) {
  return documents.filter((document) => matches(document, filters))
}

/**
 * For each option of `dimension`, how many documents would match if it were
 * the only option chosen there, given the other filters.
 */
export function facetCounts(
  documents: DocumentSummary[],
  filters: LibraryFilters,
  dimension: FacetDimension,
  options: readonly string[]
) {
  const counts = new Map<string, number>(options.map((option) => [option, 0]))
  for (const document of documents) {
    if (!matches(document, filters, dimension)) continue
    for (const value of valuesOf(document, dimension)) {
      const count = counts.get(value)
      if (count !== undefined) counts.set(value, count + 1)
    }
  }
  return counts
}

/** Pinned first (most recently pinned first), then newest first, like the
 *  server, so optimistic pins reorder the list at once. */
export function orderDocuments(documents: DocumentSummary[]) {
  return [...documents].sort((a, b) => {
    if (a.pinnedAt !== b.pinnedAt) {
      if (a.pinnedAt === null) return 1
      if (b.pinnedAt === null) return -1
      return b.pinnedAt.localeCompare(a.pinnedAt)
    }
    return b.createdAt.localeCompare(a.createdAt)
  })
}
