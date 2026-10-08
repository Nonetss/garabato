import type { SessionRecord } from "@/features/admin/sessions/model/types"
import { useHydratedInfiniteQuery } from "@/hooks/use-hydrated-infinite-query"
import { orpc } from "@/lib/orpc"

const PAGE_SIZE = 25

export function useSessionHistory() {
  const query = useHydratedInfiniteQuery({
    ...orpc.v1.sessionHistory.list.infiniteOptions({
      input: (cursor: string | null) => ({
        limit: PAGE_SIZE,
        cursor,
      }),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }),
  })

  return {
    sessions:
      query.data?.pages.flatMap((page) => page.sessions) ??
      ([] as SessionRecord[]),
    total: query.data?.pages.at(-1)?.total ?? 0,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  }
}
