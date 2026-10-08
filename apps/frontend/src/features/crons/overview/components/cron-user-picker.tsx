import { getIcon } from "@/lib/icon-registry"

const X = getIcon("controls", "x")

import { useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { SearchInput } from "@/components/shared/form/search-input"
import { UserSearchResults } from "@/components/shared/user/user-search-results"
import { Button } from "@/components/ui/button"
import { cronLabels } from "@/features/crons/shared"
import { useAdminUser } from "@/hooks/use-admin-user"
import { useAdminUserSearch } from "@/hooks/use-admin-user-search"

interface CronUserPickerProps {
  userId: string | null
  onChange: (userId: string | null) => void
  /** Shown when no user is selected and none is bound yet (creation flow). */
  defaultsToCallerHint?: boolean
}

export function CronUserPicker({
  userId,
  onChange,
  defaultsToCallerHint,
}: CronUserPickerProps) {
  const { data: selectedUser } = useAdminUser(userId)
  const [searchInput, setSearchInput] = useState("")
  const { isSearchable, isFetching, results } = useAdminUserSearch(searchInput)

  return (
    <div className="space-y-2">
      {userId ? (
        <div className="flex items-center justify-between gap-3 border-y py-3">
          <div className="min-w-0">
            <Text as="p" variant="title" className="truncate">
              {selectedUser?.name ?? userId}
            </Text>
            {selectedUser?.email ? (
              <Text as="p" variant="compact" tone="muted" className="truncate">
                {selectedUser.email}
              </Text>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={cronLabels.runsAsClear}
            className="shrink-0 text-muted-foreground"
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <SearchInput
            id="cron-runs-as-search"
            value={searchInput}
            onValueChange={setSearchInput}
            placeholder={cronLabels.runsAsSearchPlaceholder}
          />
          {isSearchable ? (
            <UserSearchResults
              results={results}
              isFetching={isFetching}
              emptyLabel={cronLabels.runsAsNoResults}
              onSelect={(user) => {
                onChange(user.id)
                setSearchInput("")
              }}
            />
          ) : null}
        </div>
      )}

      <Text as="p" variant="compact" tone="muted" className="leading-relaxed">
        {!userId && defaultsToCallerHint
          ? cronLabels.runsAsDefaultsToCallerHint
          : cronLabels.runsAsHint}
      </Text>
    </div>
  )
}
