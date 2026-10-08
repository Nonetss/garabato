import { useSearchSuggestions } from "@/hooks/use-search-suggestions"
import { orpc } from "@/lib/orpc"

export interface TeamSearchResult {
  id: string
  name: string
  organizationId: string
}

/**
 * Debounced type-ahead search over teams, optionally scoped to an
 * organization, for picker-style controls.
 */
export function useTeamSearch(searchInput: string, organizationId?: string) {
  return useSearchSuggestions<TeamSearchResult>(searchInput, {
    queryKeyPrefix: ["organization", "search-teams", organizationId ?? "all"],
    queryFn: (query) =>
      orpc.v1.organization.searchTeams.call(
        { query, organizationId },
        { context: { read: true } }
      ),
  })
}
