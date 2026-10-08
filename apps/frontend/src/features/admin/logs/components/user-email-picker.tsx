import { getIcon } from "@/lib/icon-registry"

const X = getIcon("controls", "x")

import { useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { SearchInput } from "@/components/shared/form/search-input"
import { UserSearchResults } from "@/components/shared/user/user-search-results"
import { Button } from "@/components/ui/button"
import { useAdminUser } from "@/hooks/use-admin-user"
import { useAdminUserSearch } from "@/hooks/use-admin-user-search"
import { cn } from "@/lib/utils"

interface UserEmailPickerProps {
  userId: string | null
  onChange: (userId: string | null) => void
  className?: string
}

/**
 * User filter control: search by email/name against admin `listUsers`, then
 * show the bound user with a clear button (same interaction as cron "runs as",
 * sized for a filter grid cell).
 */
export function UserEmailPicker({
  userId,
  onChange,
  className,
}: UserEmailPickerProps) {
  const { data: selectedUser } = useAdminUser(userId)
  const [searchInput, setSearchInput] = useState("")
  const { isSearchable, isFetching, results } = useAdminUserSearch(searchInput)

  if (userId) {
    return (
      <div
        className={cn(
          "flex h-9 items-center justify-between gap-2 rounded-md border border-primary/35 bg-primary/5 px-2.5",
          className
        )}
      >
        <div className="min-w-0 flex-1 truncate text-left text-sm leading-tight">
          <Text variant="title">{selectedUser?.name ?? userId}</Text>
          {selectedUser?.email ? (
            <span className="text-muted-foreground">
              {" · "}
              {selectedUser.email}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Quitar filtro de usuario"
          className="size-7 shrink-0 text-muted-foreground"
          onClick={() => onChange(null)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <SearchInput
        id="log-filter-user"
        value={searchInput}
        onValueChange={setSearchInput}
        placeholder="Nombre o email..."
        className="w-full"
      />
      {isSearchable ? (
        <UserSearchResults
          results={results}
          isFetching={isFetching}
          onSelect={(user) => {
            onChange(user.id)
            setSearchInput("")
          }}
        />
      ) : null}
    </div>
  )
}
