import { useSearchSuggestions } from "@/hooks/use-search-suggestions"
import { authClient, unwrapAuth } from "@/lib/auth-client"

const RESULT_LIMIT = 5

export interface AdminUserSearchResult {
  id: string
  name: string
  email: string
}

/**
 * Debounced search against Better Auth's admin `listUsers`, shared by every
 * "pick a user" control (cron runs-as, log filter, org member add). Keeps the
 * query key/shape and the >=2-char threshold identical across all of them.
 */
export function useAdminUserSearch(searchInput: string) {
  return useSearchSuggestions<AdminUserSearchResult>(searchInput, {
    queryKeyPrefix: ["admin", "user-search"],
    queryFn: (search) =>
      unwrapAuth(
        authClient.admin.listUsers({
          query: {
            limit: RESULT_LIMIT,
            searchField: search.includes("@") ? "email" : "name",
            searchOperator: "contains",
            searchValue: search,
          },
        })
      ).then((data) => data.users),
  })
}
