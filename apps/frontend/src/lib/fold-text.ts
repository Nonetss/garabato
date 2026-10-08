import type { SuggestInputItem } from "@/components/shared/form/suggest-input"

/** Lowercases and strips diacritics, for accent-insensitive search matching. */
export function foldText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/**
 * Builds a `SuggestInput` candidate list from an accent-insensitive text
 * query over already-loaded records: fold the query, match, cap the result
 * count, project to `SuggestInputItem`. Replaces the repeated
 * `foldText(...).filter(...).slice(0, 8).map(...)` cascade across the
 * organizations/teams/crons search filters. Record matching stays the
 * caller's own predicate — this only owns the fold/cap/project boilerplate.
 */
export function textSuggestions<TItem>(
  items: TItem[],
  query: string,
  options: {
    match: (item: TItem, foldedQuery: string) => boolean
    toItem: (item: TItem) => SuggestInputItem
    limit?: number
  }
): SuggestInputItem[] {
  const foldedQuery = foldText(query.trim())
  if (!foldedQuery) return []
  return items
    .filter((item) => options.match(item, foldedQuery))
    .slice(0, options.limit ?? 8)
    .map(options.toItem)
}
