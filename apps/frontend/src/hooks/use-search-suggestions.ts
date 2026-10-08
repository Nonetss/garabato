import { useQuery } from "@tanstack/react-query"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

interface UseSearchSuggestionsOptions<T> {
  queryKeyPrefix: readonly unknown[]
  queryFn: (search: string) => Promise<T[]>
  minLength?: number
  debounceMs?: number
}

/**
 * Debounced "type to see suggestions below" search: waits for the input to
 * settle, gates the query behind a minimum length, and exposes the result
 * list plus fetching state. `queryFn` receives the debounced search string
 * and does the actual lookup (oRPC, Better Auth admin API, ...).
 */
export function useSearchSuggestions<T>(
  searchInput: string,
  {
    queryKeyPrefix,
    queryFn,
    minLength = 2,
    debounceMs = 300,
  }: UseSearchSuggestionsOptions<T>
) {
  const search = useDebouncedValue(searchInput, debounceMs)
  const isSearchable = search.length >= minLength

  const { data, isFetching } = useQuery({
    queryKey: [...queryKeyPrefix, search],
    queryFn: () => queryFn(search),
    enabled: isSearchable,
  })

  return {
    search,
    isSearchable,
    isFetching,
    results: data ?? [],
  }
}
