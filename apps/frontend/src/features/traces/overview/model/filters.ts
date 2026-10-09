import { addDays, startOfDay } from "date-fns"
import type { ResourceFacetValue } from "@/components/shared/resource/resource-filters"
import {
  TRAIL_TYPES,
  type TrailType,
} from "@/features/traces/overview/model/types"
import { formatPages } from "@/lib/format"

/** Every certificate: the certificate filter's "no filter" value. */
export const ALL_CERTIFICATES = "all"

export type TraceFilters = {
  /** Text the document name or certificate alias contains. */
  query: string
  /** Types to include and to exclude. */
  types: ResourceFacetValue
  /** A certificate id, or `ALL_CERTIFICATES`. */
  certificateId: string
  /** First day to include, whole. */
  from: Date | undefined
  /** Last day to include, whole. */
  to: Date | undefined
}

export const emptyTraceFilters: TraceFilters = {
  query: "",
  types: { include: [], exclude: [] },
  certificateId: ALL_CERTIFICATES,
  from: undefined,
  to: undefined,
}

/** The `trace.list` filters, without paging. */
export type TraceQueryInput = {
  query?: string
  types?: TrailType[]
  excludedTypes?: TrailType[]
  certificateId?: string
  from?: string
  before?: string
}

function isTrailType(value: string): value is TrailType {
  return TRAIL_TYPES.some((type) => type === value)
}

// The chosen days in order, so picking "Hasta" before "Desde" still reads
// as a range instead of an empty (and rejected) interval.
function orderedDays(from: Date | undefined, to: Date | undefined) {
  if (from && to && from > to) return { first: to, last: from }
  return { first: from, last: to }
}

/** Maps the page's filters to the API input: whole days in the browser's
 *  time zone, from the start of `from` to the start of the day after `to`. */
export function traceQueryInput(filters: TraceFilters): TraceQueryInput {
  const input: TraceQueryInput = {}
  const query = filters.query.trim()
  if (query !== "") input.query = query
  const types = filters.types.include.filter(isTrailType)
  if (types.length > 0) input.types = types
  const excludedTypes = filters.types.exclude.filter(isTrailType)
  if (excludedTypes.length > 0) input.excludedTypes = excludedTypes
  if (filters.certificateId !== ALL_CERTIFICATES) {
    input.certificateId = filters.certificateId
  }
  const { first, last } = orderedDays(filters.from, filters.to)
  if (first) input.from = startOfDay(first).toISOString()
  if (last) input.before = addDays(startOfDay(last), 1).toISOString()
  return input
}

export function activeTraceFilterCount(filters: TraceFilters) {
  return [
    filters.query.trim() !== "",
    filters.types.include.length > 0 || filters.types.exclude.length > 0,
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
