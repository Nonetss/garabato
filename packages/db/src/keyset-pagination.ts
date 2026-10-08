import { type AnyColumn, and, desc, eq, lt, or, type SQL } from "drizzle-orm"
import type { PgSelect } from "drizzle-orm/pg-core"

export function withKeysetPagination<T extends PgSelect>(
  qb: T,
  opts: {
    orderColumns: [AnyColumn, AnyColumn]
    cursor?: { timestamp: Date; id: string }
    filters?: (SQL | undefined)[]
    limit: number
  }
) {
  const [timestampColumn, idColumn] = opts.orderColumns
  const conditions = (opts.filters ?? []).filter(
    (filter): filter is SQL => filter !== undefined
  )

  if (opts.cursor) {
    const { timestamp, id } = opts.cursor
    const cursorCondition = or(
      lt(timestampColumn, timestamp),
      and(eq(timestampColumn, timestamp), lt(idColumn, id))
    )
    if (cursorCondition) {
      conditions.push(cursorCondition)
    }
  }

  return qb
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(timestampColumn), desc(idColumn))
    .limit(opts.limit)
}
