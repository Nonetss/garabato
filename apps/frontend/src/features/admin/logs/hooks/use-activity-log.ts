import { endOfDay, startOfDay } from "date-fns"
import { useMemo, useState } from "react"
import type {
  ActivityLogEntry,
  ActivityLogFilters,
} from "@/features/admin/logs/model/types"
import { useHydratedInfiniteQuery } from "@/hooks/use-hydrated-infinite-query"
import { orpc } from "@/lib/orpc"

const PAGE_SIZE = 50

const emptyFilters: ActivityLogFilters = {
  userId: "",
  type: "all",
  method: "all",
  path: "",
  from: undefined,
  to: undefined,
}

export function useActivityLog() {
  const [filters, setFilters] = useState<ActivityLogFilters>(emptyFilters)

  const queryInput = useMemo(
    () => ({
      userId: filters.userId.trim() || undefined,
      type: filters.type === "all" ? undefined : filters.type,
      method: filters.method === "all" ? undefined : filters.method,
      path: filters.path.trim() || undefined,
      from: filters.from ? startOfDay(filters.from).toISOString() : undefined,
      to: filters.to ? endOfDay(filters.to).toISOString() : undefined,
    }),
    [filters]
  )

  const query = useHydratedInfiniteQuery({
    ...orpc.v1.logs.query.infiniteOptions({
      input: (cursor: string | null) => ({
        ...queryInput,
        before: cursor ?? undefined,
        limit: PAGE_SIZE,
      }),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }),
  })

  const entries =
    query.data?.pages.flatMap((page) => page.entries) ??
    ([] as ActivityLogEntry[])

  const activeCount =
    (filters.userId.trim() ? 1 : 0) +
    (filters.type !== "all" ? 1 : 0) +
    (filters.method !== "all" ? 1 : 0) +
    (filters.path.trim() ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0)

  return {
    entries,
    filters,
    setFilters,
    clearFilters: () => setFilters(emptyFilters),
    activeCount,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  }
}
