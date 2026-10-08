import {
  keepPreviousData,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query"
import {
  type AppSurface,
  appSurfaceList,
  isSurfacePathActive,
  type SurfaceSearchSourceId,
} from "@/lib/app-surfaces"
import { foldText } from "@/lib/fold-text"
import { orpc } from "@/lib/orpc"

/** One record behind a dynamic surface, as the navbar search lists it. */
export interface SurfaceSearchEntry {
  /** Values for the surface path's `[param]` segments. */
  params: Record<string, string>
  label: string
  description?: string
  /**
   * Extra terms the record matches on, for what a server-searched source's
   * endpoint matched but the label doesn't show (an address, a code).
   */
  keywords?: string[]
}

type SearchQueryOptions<TData, TError, TQueryKey extends QueryKey> = (options: {
  enabled: boolean
  /** Settled text for a server-searched source; full-list sources ignore it. */
  search: string
}) => UseQueryOptions<TData, TError, SurfaceSearchEntry[], TQueryKey>

/**
 * One source of the registry. It keeps its procedure's own record, error and
 * key types, so nothing is erased: the registry is checked with `satisfies`
 * and the hook reads the union of the actual sources.
 */
export interface SurfaceSearchSource<
  TData,
  TError,
  TQueryKey extends QueryKey,
> {
  /** Heading of the search group that lists this source's records. */
  heading: string
  /**
   * `true` when the entity is listed in pages, so the source asks the
   * entity's `search` for the records matching the text instead of loading
   * its whole `list`.
   */
  serverSearch: boolean
  /**
   * The entity's own query with a `select` that maps the records to entries.
   * A full-list source keeps the list page's options (same key, so same
   * cache and invalidation); a server-searched one spreads
   * `serverSearchQuery`.
   */
  queryOptions: SearchQueryOptions<TData, TError, TQueryKey>
}

/**
 * What the registry checks on every entry. Its `queryOptions`, and the
 * `select` inside, are already checked by `defineSearchSource` and
 * `defineServerSearchSource`, which every entry goes through.
 */
interface SurfaceSearchSourceShape {
  heading: string
  serverSearch: boolean
}

/** Records a server-searched source lists, `searchLimit()`'s default. */
const SEARCH_RECORD_LIMIT = 5
/** Shortest text a server-searched source is asked for, as `searchQuery()`. */
const MIN_SERVER_SEARCH_LENGTH = 2

/**
 * A source that loads the entity's whole list. `select` is type-checked
 * against the procedure's output.
 */
function defineSearchSource<TData, TError, TQueryKey extends QueryKey>(
  heading: string,
  queryOptions: SearchQueryOptions<TData, TError, TQueryKey>
): SurfaceSearchSource<TData, TError, TQueryKey> {
  return { heading, serverSearch: false, queryOptions }
}

/** `defineSearchSource` for an entity listed in pages: see the registry. */
export function defineServerSearchSource<
  TData,
  TError,
  TQueryKey extends QueryKey,
>(
  heading: string,
  queryOptions: SearchQueryOptions<TData, TError, TQueryKey>
): SurfaceSearchSource<TData, TError, TQueryKey> {
  return { heading, serverSearch: true, queryOptions }
}

/**
 * Input and gating for a server-searched source's `search` procedure (the
 * `{ query, limit }` shape of `#shared/search`): asked only while the dialog
 * is open and the text is long enough, keeping the last answer on screen
 * while the next one loads but not once the text no longer searches.
 */
export function serverSearchQuery({
  enabled,
  search,
}: {
  enabled: boolean
  search: string
}) {
  const input = { query: search, limit: SEARCH_RECORD_LIMIT }
  const searchable = enabled && search.length >= MIN_SERVER_SEARCH_LENGTH
  if (!searchable) {
    return { input, enabled: false, placeholderData: undefined }
  }
  return { input, enabled: true, placeholderData: keepPreviousData }
}

/**
 * How the navbar search enumerates the records of each dynamic surface that
 * declares a `searchSource` in `app-surfaces.ts`: always through that
 * entity's own procedure. Keyed by the full id union, so a new source key
 * fails type-checking until it gets an entry here.
 *
 * An entity listed in full uses its `list` with `defineSearchSource`, and
 * the dialog matches the loaded records locally. An entity listed in pages
 * uses its `search` (see the stack skill's `references/api/free-text-search.md`)
 * with `defineServerSearchSource`, which the hook asks for the settled text:
 *
 * ```ts
 * "devices": defineServerSearchSource("Dispositivos", (options) =>
 *   orpc.v1.device.search.queryOptions({
 *     ...serverSearchQuery(options),
 *     select: ({ devices }) =>
 *       devices.map((device) => ({
 *         params: { id: device.id },
 *         label: device.name ?? device.ip,
 *         description: device.ip,
 *         keywords: [device.ip],
 *       })),
 *   })
 * ),
 * ```
 */
/** A job's line in the search: its description, or its cron expression. */
function jobSearchDescription(job: {
  description: string | null
  cronExpression: string
}): string {
  if (job.description !== null) return job.description
  return job.cronExpression
}

export const surfaceSearchSources = {
  "cron-jobs": defineSearchSource("Tareas programadas", ({ enabled }) =>
    orpc.v1.cron.list.queryOptions({
      enabled,
      select: (jobs) =>
        jobs.map((job) => ({
          params: { id: job.id },
          label: job.name,
          description: jobSearchDescription(job),
        })),
    })
  ),
} satisfies Record<SurfaceSearchSourceId, SurfaceSearchSourceShape>

export interface SearchSourceSurface {
  surface: AppSurface
  source: SurfaceSearchSourceId
  /** Labels of the concrete-path surfaces above the route, outermost first. */
  trail: string[]
}

/**
 * Labels of the concrete-path surfaces a record's route sits under
 * (`/crons/[id]` → "Crons"; a deeper route lists every section above it,
 * outermost first). Shown before the record's label and matched like it, so
 * typing a section's name lists its records.
 */
function getRecordTrail(surface: AppSurface): string[] {
  const staticPrefix = surface.path.slice(0, surface.path.indexOf("[") - 1)
  return appSurfaceList
    .filter(
      (other) =>
        !other.path.includes("[") &&
        isSurfacePathActive(other.path, staticPrefix)
    )
    .map((other) => other.label)
}

/**
 * The words of `search` that none of the source's own section labels
 * contain, which are what its server search has to find ("crons limpieza" →
 * "limpieza"). The dialog still matches the dropped words locally, against
 * the record's trail and surface label.
 */
export function serverSearchText(search: string, sectionLabels: string[]) {
  const foldedLabels = sectionLabels.map(foldText)
  return search
    .split(/\s+/)
    .filter(
      (word) =>
        word && !foldedLabels.some((label) => label.includes(foldText(word)))
    )
    .join(" ")
}

/**
 * Dynamic surfaces whose records the navbar search lists for this user:
 * a `[param]` path with a `searchSource`, `adminOnly` ones only for admins.
 */
export function getSearchSourceSurfaces(
  isAdmin: boolean
): SearchSourceSurface[] {
  return appSurfaceList.flatMap((surface) => {
    if (!surface.searchSource || !surface.path.includes("[")) return []
    if (surface.adminOnly && !isAdmin) return []
    return [
      {
        surface,
        source: surface.searchSource,
        trail: getRecordTrail(surface),
      },
    ]
  })
}

/**
 * Fills each `[name]` segment of a surface path (`/crons/[id]`) with the
 * URI-encoded value from `params`; `null` when a segment has no value.
 */
export function fillSurfacePath(
  path: string,
  params: Record<string, string>
): string | null {
  let missing = false
  const filled = path.replace(/\[([^\]]+)\]/g, (_segment, name: string) => {
    const value = params[name]
    if (!value) missing = true
    return encodeURIComponent(value ?? "")
  })
  if (missing) return null
  return filled
}
