import { Text, textVariants } from "@/components/shared/brand/typography"
import { SearchSuggestionsList } from "@/components/shared/form/search-suggestions-list"
import type { AdminUserSearchResult } from "@/hooks/use-admin-user-search"
import { cn } from "@/lib/utils"

interface UserSearchResultsProps {
  results: AdminUserSearchResult[]
  isFetching: boolean
  onSelect: (user: AdminUserSearchResult) => void
  emptyLabel?: string
  className?: string
}

/**
 * The dropdown under an admin user-search input: loading spinner, empty
 * state, or a list of name/email buttons. Pairs with `useAdminUserSearch`.
 */
export function UserSearchResults({
  results,
  isFetching,
  onSelect,
  emptyLabel,
  className,
}: UserSearchResultsProps) {
  return (
    <SearchSuggestionsList
      results={results}
      isFetching={isFetching}
      onSelect={onSelect}
      getKey={(user) => user.id}
      emptyLabel={emptyLabel}
      className={className}
      renderItem={(user) => (
        <>
          <span className={cn(textVariants({ role: "title" }), "truncate")}>
            {user.name}
          </span>
          <Text variant="compact" tone="muted" className="truncate">
            {user.email}
          </Text>
        </>
      )}
    />
  )
}
