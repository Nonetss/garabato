import { getIcon } from "@/lib/icon-registry"

const X = getIcon("controls", "x")

import type { ReactNode } from "react"
import { SearchInput } from "@/components/shared/form/search-input"
import { SearchSuggestionsList } from "@/components/shared/form/search-suggestions-list"
import { Button } from "@/components/ui/button"

export interface EntityPickerProps<TItem> {
  id?: string
  searchInput: string
  onSearchInputChange: (value: string) => void
  /** Whether the query is eligible to run — typically `searchInput.trim().length >= threshold`. */
  isSearchable: boolean
  isFetching: boolean
  results: TItem[]
  getKey: (item: TItem) => string
  renderResult: (item: TItem) => ReactNode
  selected: TItem | null
  onSelect: (item: TItem) => void
  onClear: () => void
  renderSelected: (item: TItem) => ReactNode
  /** Accessible label for the clear button, e.g. `"Quitar equipo"`. Defaults to `"Cambiar"` (visible text, not just aria-label). */
  clearLabel?: string
  placeholder?: string
  emptyLabel?: string
  className?: string
}

/**
 * Generic searchable entity picker: search input + suggestion dropdown while
 * nothing is selected, a bordered selected-summary row with a clear/change
 * action once something is. Owns that structure — callers supply query
 * state (typically from a `useSearchSuggestions`-shaped hook) and item
 * identity/rendering, never the picker's own layout.
 */
export function EntityPicker<TItem>({
  id,
  searchInput,
  onSearchInputChange,
  isSearchable,
  isFetching,
  results,
  getKey,
  renderResult,
  selected,
  onSelect,
  onClear,
  renderSelected,
  clearLabel = "Cambiar",
  placeholder,
  emptyLabel,
  className,
}: EntityPickerProps<TItem>) {
  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <div className="min-w-0 flex-1">{renderSelected(selected)}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={clearLabel}
          className="shrink-0 text-muted-foreground"
          onClick={onClear}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className={className}>
      <SearchInput
        id={id}
        value={searchInput}
        onValueChange={onSearchInputChange}
        placeholder={placeholder}
      />
      {isSearchable ? (
        <SearchSuggestionsList
          className="mt-2"
          results={results}
          isFetching={isFetching}
          getKey={getKey}
          onSelect={onSelect}
          renderItem={renderResult}
          emptyLabel={emptyLabel}
        />
      ) : null}
    </div>
  )
}
