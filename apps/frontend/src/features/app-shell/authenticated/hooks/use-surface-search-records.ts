import { useQueries } from "@tanstack/react-query"
import { useMemo } from "react"
import {
  getSearchSourceSurfaces,
  serverSearchText,
  surfaceRecordHref,
  surfaceSearchSources,
} from "@/features/app-shell/authenticated/model/surface-search-sources"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { resolveIconRef } from "@/lib/icon-registry"
import type { SiteNavSearchGroup } from "@/lib/site-nav"

/** Pause after the last keystroke before server-searched sources are asked:
 *  short, since the palette is typed in short bursts and waits on it. */
const SEARCH_DEBOUNCE_MS = 150

interface UseSurfaceSearchRecordsOptions {
  isAdmin: boolean
  /** Fetch only while the search dialog is open. */
  enabled: boolean
  /** What the user typed; server-searched sources query its settled form. */
  search: string
}

/**
 * Records behind the surfaces that declare a `searchSource`, as one
 * search group per source. Full-list sources reuse each list page's query
 * (shared cache, so an already loaded list costs no request); server-searched
 * ones ask their entity's `search` for the debounced text, minus the words
 * their own section labels already match. A source that is still loading or
 * failed yields no group, so the static results never wait on it.
 */
export function useSurfaceSearchRecords({
  isAdmin,
  enabled,
  search,
}: UseSurfaceSearchRecordsOptions): SiteNavSearchGroup[] {
  const targets = useMemo(() => getSearchSourceSurfaces(isAdmin), [isAdmin])
  const settledSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const results = useQueries({
    queries: targets.map(({ surface, source, trail }) => {
      const { serverSearch, queryOptions } = surfaceSearchSources[source]
      return queryOptions({
        enabled,
        search: serverSearch
          ? serverSearchText(settledSearch, [...trail, surface.label])
          : "",
      })
    }),
  })

  return targets.flatMap(({ surface, source, trail }, index) => {
    const entries = results[index]?.data
    if (!entries?.length) return []
    const heading = surfaceSearchSources[source].heading
    const icon = resolveIconRef(surface.icon)
    const items = entries.flatMap((entry) => {
      const href = surfaceRecordHref(surface.path, entry)
      if (href == null) return []
      return [
        {
          href,
          label: entry.label,
          description: entry.description ?? surface.description,
          icon,
          section: heading,
          trail,
          keywords: [surface.label, ...(entry.keywords ?? [])],
        },
      ]
    })
    return items.length > 0 ? [{ label: heading, items }] : []
  })
}
