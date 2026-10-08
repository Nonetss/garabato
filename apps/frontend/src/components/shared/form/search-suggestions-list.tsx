import type { ReactNode } from "react"
import { Text } from "@/components/shared/brand/typography"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface SearchSuggestionsListProps<T> {
  results: T[]
  isFetching: boolean
  onSelect: (item: T) => void
  renderItem: (item: T) => ReactNode
  getKey: (item: T) => string
  emptyLabel?: string
  className?: string
}

/**
 * The dropdown that goes under any "type to search" input: loading spinner,
 * empty state, or a list of selectable rows. Domain-free — pairs with
 * `useSearchSuggestions` and a per-domain `renderItem`.
 */
export function SearchSuggestionsList<T>({
  results,
  isFetching,
  onSelect,
  renderItem,
  getKey,
  emptyLabel = "Sin resultados",
  className,
}: SearchSuggestionsListProps<T>) {
  return (
    <div
      className={cn(
        "max-h-48 overflow-y-auto rounded-lg border bg-card/40 divide-y",
        className
      )}
    >
      {isFetching ? (
        <div className="flex items-center justify-center p-4">
          <Spinner className="text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <Text as="p" variant="compact" tone="muted" className="p-4 text-center">
          {emptyLabel}
        </Text>
      ) : (
        results.map((item) => (
          <button
            key={getKey(item)}
            type="button"
            onClick={() => onSelect(item)}
            className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {renderItem(item)}
          </button>
        ))
      )}
    </div>
  )
}
