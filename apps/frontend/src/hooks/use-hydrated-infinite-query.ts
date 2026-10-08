import {
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
} from "@tanstack/react-query"
import { useHydrated } from "@/hooks/use-hydrated"

/**
 * SSR-safe wrapper around `useInfiniteQuery` for Astro `client:only` islands.
 * Mirrors `useHydratedQuery`: ignore cache until hydration completes.
 */
export function useHydratedInfiniteQuery<
  TQueryFnData,
  TError = Error,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  options: UseInfiniteQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >
): UseInfiniteQueryResult<TData, TError> {
  const hydrated = useHydrated()
  const query = useInfiniteQuery({
    ...options,
    enabled: hydrated && (options.enabled ?? true),
  })

  if (!hydrated) {
    return {
      ...query,
      data: undefined,
      error: null,
      isError: false,
      isPending: true,
      isLoading: true,
      isFetching: false,
      isFetchNextPageError: false,
      isFetchPreviousPageError: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      isRefetching: false,
      isSuccess: false,
      hasNextPage: false,
      hasPreviousPage: false,
      status: "pending",
      fetchStatus: "idle",
    } as UseInfiniteQueryResult<TData, TError>
  }

  return query
}
