import { useCallback, useMemo, useState } from "react"
import {
  activeTraceFilterCount,
  emptyTraceFilters,
  type TraceFilters,
  traceQueryInput,
} from "@/features/traces/overview/model/filters"
import type {
  TraceCertificate,
  TrailEntry,
} from "@/features/traces/overview/model/types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useHydratedInfiniteQuery } from "@/hooks/use-hydrated-infinite-query"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

const PAGE_SIZE = 25

const noEntries: TrailEntry[] = []
const noCertificates: TraceCertificate[] = []

function certificateOptions(data: TraceCertificate[] | undefined) {
  if (!data) return noCertificates
  return data
}

/** The traces page's filters, its paged trail and the certificates its
 *  filter offers. */
export function useTraces() {
  const [filters, setFilters] = useState<TraceFilters>(emptyTraceFilters)
  // The text box stays instant; only the request waits for a pause.
  const query = useDebouncedValue(filters.query)
  const queryInput = useMemo(
    () => traceQueryInput({ ...filters, query }),
    [filters, query]
  )

  const trail = useHydratedInfiniteQuery(
    orpc.v1.trace.list.infiniteOptions({
      input: (cursor: string | null) => ({
        ...queryInput,
        cursor,
        limit: PAGE_SIZE,
      }),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
  )
  const certificates = useHydratedQuery(
    orpc.v1.trace.certificates.queryOptions()
  )

  const entries = useMemo((): TrailEntry[] => {
    if (!trail.data) return noEntries
    return trail.data.pages.flatMap((page) => page.entries)
  }, [trail.data])
  const total = trail.data?.pages[0]?.total

  const clearFilters = useCallback(() => setFilters(emptyTraceFilters), [])

  return {
    entries,
    total,
    certificates: certificateOptions(certificates.data),
    filters,
    setFilters,
    clearFilters,
    activeCount: activeTraceFilterCount(filters),
    hasNextPage: trail.hasNextPage,
    isFetchingNextPage: trail.isFetchingNextPage,
    fetchNextPage: trail.fetchNextPage,
    isPending: trail.isPending,
    isError: trail.isError,
    refetch: trail.refetch,
  }
}
