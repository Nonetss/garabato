import { useSearchSuggestions } from "@/hooks/use-search-suggestions"
import { orpc } from "@/lib/orpc"

export interface OrganizationSearchResult {
  id: string
  name: string
  slug: string
}

/** Debounced type-ahead search over organizations, for picker-style controls. */
export function useOrganizationSearch(searchInput: string) {
  return useSearchSuggestions<OrganizationSearchResult>(searchInput, {
    queryKeyPrefix: ["organization", "search"],
    queryFn: (query) =>
      orpc.v1.organization.search.call({ query }, { context: { read: true } }),
  })
}
