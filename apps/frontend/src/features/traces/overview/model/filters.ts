import { addDays, startOfDay } from "date-fns"
import { formatPages } from "@/lib/format"

/** Every certificate: the certificate filter's "no filter" value. */
export const ALL_CERTIFICATES = "all"

export type SignatureLogFilters = {
  /** Text the document name contains. */
  query: string
  /** A certificate id, or `ALL_CERTIFICATES`. */
  certificateId: string
  /** First day to include, whole. */
  from: Date | undefined
  /** Last day to include, whole. */
  to: Date | undefined
}

export const emptySignatureLogFilters: SignatureLogFilters = {
  query: "",
  certificateId: ALL_CERTIFICATES,
  from: undefined,
  to: undefined,
}

/** The `document.signatureLog` filters, without paging. */
export type SignatureLogQueryInput = {
  query?: string
  certificateId?: string
  signedFrom?: string
  signedBefore?: string
}

// The chosen days in order, so picking "Hasta" before "Desde" still reads
// as a range instead of an empty (and rejected) interval.
function orderedDays(from: Date | undefined, to: Date | undefined) {
  if (from && to && from > to) return { first: to, last: from }
  return { first: from, last: to }
}

/** Maps the page's filters to the API input: whole days in the browser's
 *  time zone, from the start of `from` to the start of the day after `to`. */
export function signatureLogQueryInput(
  filters: SignatureLogFilters
): SignatureLogQueryInput {
  const input: SignatureLogQueryInput = {}
  const query = filters.query.trim()
  if (query !== "") input.query = query
  if (filters.certificateId !== ALL_CERTIFICATES) {
    input.certificateId = filters.certificateId
  }
  const { first, last } = orderedDays(filters.from, filters.to)
  if (first) input.signedFrom = startOfDay(first).toISOString()
  if (last) input.signedBefore = addDays(startOfDay(last), 1).toISOString()
  return input
}

export function activeSignatureLogFilterCount(filters: SignatureLogFilters) {
  return [
    filters.query.trim() !== "",
    filters.certificateId !== ALL_CERTIFICATES,
    filters.from !== undefined,
    filters.to !== undefined,
  ].filter(Boolean).length
}

/** "Firma invisible", "Visible en página 2", "Visible en páginas 1, 3". */
export function placementLabel(record: { visible: boolean; pages: number[] }) {
  if (!record.visible) return "Firma invisible"
  if (record.pages.length === 1) {
    return `Visible en página ${formatPages(record.pages)}`
  }
  return `Visible en páginas ${formatPages(record.pages)}`
}

/** A name, marked when what it names has been deleted. */
export function deletedAware(name: string, deleted: boolean) {
  if (!deleted) return name
  return `${name} (eliminado)`
}
