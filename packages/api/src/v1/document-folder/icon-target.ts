import { db } from "@nonete/db"
import { documentFolders } from "@nonete/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import type { Context } from "#context"
import { requireUserId } from "#shared/caller"
import type { EntityIconTarget } from "#v1/entity-icon/targets"

/** The entity type folders use in the entity icon registry. */
export const DOCUMENT_FOLDER_ENTITY_TYPE = "documentFolder"

const uuid = z.uuid()

// Only the owner may see or restyle a folder's icon. Ids that aren't uuids
// can't be folders, and would make PostgreSQL reject the whole query.
async function ownedFolderIds({
  context,
  entityIds,
}: {
  context: Context
  entityIds: string[]
}) {
  const userId = requireUserId(context)
  const ids = entityIds.filter((id) => uuid.safeParse(id).success)
  if (ids.length === 0) return new Set<string>()
  const rows = await db
    .select({ id: documentFolders.id })
    .from(documentFolders)
    .where(
      and(eq(documentFolders.userId, userId), inArray(documentFolders.id, ids))
    )
  return new Set(rows.map((row) => row.id))
}

export const documentFolderIconTarget: EntityIconTarget = {
  readable: ownedFolderIds,
  writable: ownedFolderIds,
}
