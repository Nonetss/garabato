import { db } from "@nonete/db"
import { collection } from "@nonete/db/schema"
import { and, eq, inArray } from "drizzle-orm"

import type { Context } from "#context"

type AccessArgs = { context: Context; entityIds: string[] }

/**
 * Decides which entities of one type the caller may see or restyle. Each
 * method returns the subset of `entityIds` the caller is allowed to touch.
 */
export type EntityIconTarget = {
  readable: (args: AccessArgs) => Promise<Set<string>>
  writable: (args: AccessArgs) => Promise<Set<string>>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Custom collections owned by the caller; favorites never carry an icon. */
async function ownedCustomCollections({ context, entityIds }: AccessArgs) {
  // Collection ids are UUIDs; anything else cannot match and would make
  // Postgres reject the whole query.
  const ids = entityIds.filter((id) => UUID_PATTERN.test(id))
  if (!context.user || ids.length === 0) return new Set<string>()

  const rows = await db
    .select({ id: collection.id })
    .from(collection)
    .where(
      and(
        inArray(collection.id, ids),
        eq(collection.ownerId, context.user.id),
        eq(collection.kind, "custom")
      )
    )
  return new Set(rows.map((row) => row.id))
}

/**
 * Entity types that accept icons. Enabling icons for a new entity type is a
 * new entry here; the table, procedures and frontend components stay as-is.
 */
export const entityIconTargets: Record<string, EntityIconTarget> = {
  collection: {
    readable: ownedCustomCollections,
    writable: ownedCustomCollections,
  },
}
