import { z } from "zod"

import { errors } from "#errors"

/** `rows` MUST be over-fetched by `limit + 1` for `hasMore` to be accurate. */
export function paginate<T>(
  rows: T[],
  limit: number
): { page: T[]; hasMore: boolean; lastRow: T | undefined } {
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return { page, hasMore, lastRow: page.at(-1) }
}

/**
 * `paginate`, plus the grand total across every page. `totalRows` should be
 * a `count()` query built from the same `.from()`/joins/filters as `rows`,
 * minus the cursor condition — the two run in parallel since neither depends
 * on the other.
 */
export async function paginateWithTotal<T>(
  rows: Promise<T[]>,
  totalRows: Promise<{ total: number }[]>,
  limit: number
): Promise<{
  page: T[]
  hasMore: boolean
  lastRow: T | undefined
  total: number
}> {
  const [rowsResult, totalResult] = await Promise.all([rows, totalRows])
  const { page, hasMore, lastRow } = paginate(rowsResult, limit)
  return { page, hasMore, lastRow, total: totalResult[0]?.total ?? 0 }
}

export function encodeKeysetCursor(timestamp: Date, id: string): string {
  return `${timestamp.toISOString()}|${id}`
}

export function decodeKeysetCursor(
  cursor: string | null | undefined
): { timestamp: Date; id: string } | undefined {
  if (!cursor) return undefined
  const separatorIndex = cursor.indexOf("|")
  const timestamp = new Date(cursor.slice(0, separatorIndex))
  const id = cursor.slice(separatorIndex + 1)
  if (separatorIndex === -1 || Number.isNaN(timestamp.getTime()) || !id) {
    throw errors.BAD_REQUEST({ message: "Invalid pagination cursor" })
  }
  return { timestamp, id }
}

export function paginationLimit(defaultLimit: number, maxLimit: number) {
  return z.number().int().min(1).max(maxLimit).default(defaultLimit)
}

export function paginationCursor() {
  return z
    .string()
    .nullish()
    .describe(
      "Opaque pagination cursor from a previous response's nextCursor; omit for the first page"
    )
}
