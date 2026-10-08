import { db } from "@nonete/db"
import { session } from "@nonete/db/schema/auth"
import { count } from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { toIso } from "#shared/dates"
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  paginate,
} from "#shared/pagination"
import type { sessionHistoryInput } from "#v1/session-history/input"

/**
 * Drizzle's relational API rejects `where: undefined`, so the first page
 * returns an empty filter instead.
 */
function keysetFilter(cursor: { timestamp: Date; id: string } | undefined) {
  if (!cursor) return {}
  return {
    OR: [
      { createdAt: { lt: cursor.timestamp } },
      { createdAt: { eq: cursor.timestamp }, id: { lt: cursor.id } },
    ],
  }
}

export const sessionHistoryHandler = {
  list: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof sessionHistoryInput.list>
  }) => {
    void context
    const cursor = decodeKeysetCursor(input.cursor)

    const [rows, countRows] = await Promise.all([
      db.query.session.findMany({
        with: { user: true },
        where: keysetFilter(cursor),
        orderBy: { createdAt: "desc", id: "desc" },
        limit: input.limit + 1,
      }),
      db.select({ total: count() }).from(session),
    ])
    const total = countRows[0]?.total ?? 0
    const { page, hasMore, lastRow } = paginate(rows, input.limit)

    return {
      sessions: page.flatMap((row) => {
        if (!row.user) return []
        return [
          {
            id: row.id,
            userId: row.userId,
            user: {
              id: row.user.id,
              name: row.user.name,
              email: row.user.email,
              image: row.user.image,
            },
            ipAddress: row.ipAddress,
            userAgent: row.userAgent,
            createdAt: toIso(row.createdAt),
            updatedAt: toIso(row.updatedAt),
            expiresAt: toIso(row.expiresAt),
            impersonatedBy: row.impersonatedBy,
            activeOrganizationId: row.activeOrganizationId,
            activeTeamId: row.activeTeamId,
          },
        ]
      }),
      total,
      nextCursor:
        hasMore && lastRow
          ? encodeKeysetCursor(lastRow.createdAt, lastRow.id)
          : null,
    }
  },
}
