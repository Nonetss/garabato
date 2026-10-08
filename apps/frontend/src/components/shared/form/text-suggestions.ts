import type { SuggestInputItem } from "@/components/shared/form/suggest-input"
import { foldText } from "@/lib/fold-text"

/**
 * Suggestions from data already in memory (no network): prefix matches
 * first, substring matches second; within each group sorted alphabetically,
 * unless `sortNumeric` is set and the values are all numbers (ports: `"2"`
 * before `"10"`). Matching is accent-insensitive via `foldText`, consistent
 * with `SearchableCombobox`'s filter.
 */
export function textSuggestions(
  values: Iterable<string | null | undefined>,
  query: string,
  limit = 8,
  options: { sortNumeric?: boolean } = {}
): SuggestInputItem[] {
  const q = foldText(query.trim())
  if (!q) return []

  const unique = new Set<string>()
  for (const raw of values) {
    if (raw) unique.add(raw)
  }

  const compare = options.sortNumeric
    ? (a: string, b: string) => {
        const na = Number(a)
        const nb = Number(b)
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
        return a.localeCompare(b)
      }
    : (a: string, b: string) => a.localeCompare(b)

  const starts: string[] = []
  const contains: string[] = []
  for (const raw of unique) {
    const folded = foldText(raw)
    if (folded.startsWith(q)) starts.push(raw)
    else if (folded.includes(q)) contains.push(raw)
  }
  starts.sort(compare)
  contains.sort(compare)

  return [...starts, ...contains]
    .slice(0, limit)
    .map((value) => ({ key: value, value, label: value }))
}
