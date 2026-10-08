import { z } from "zod"

/** Query param for "type to see suggestions" search endpoints. */
export function searchQuery(minLength = 2) {
  return z
    .string()
    .trim()
    .min(minLength)
    .describe(`Search term (min ${minLength} characters)`)
}

/** Suggestion lists stay small — default/max are far below list-page limits. */
export function searchLimit(defaultLimit = 5, maxLimit = 20) {
  return z.number().int().min(1).max(maxLimit).default(defaultLimit)
}

/**
 * Escapes ILIKE wildcards in a user-supplied term, then wraps it for a
 * "contains" match. Use as the value of an `{ ilike: ... }` RQB filter.
 */
export function likePattern(term: string): string {
  return `%${term.replace(/[%_\\]/g, (char) => `\\${char}`)}%`
}
