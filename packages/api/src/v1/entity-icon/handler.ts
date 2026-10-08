import { db } from "@nonete/db"
import { entityIcons } from "@nonete/db/schema"
import { and, eq, inArray, or } from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import type { entityIconInput } from "#v1/entity-icon/input"
import {
  type EntityIconTarget,
  entityIconTargets,
} from "#v1/entity-icon/targets"

type EntityRef = { entityType: string; entityId: string }

type Executor = Pick<typeof db, "delete">

function requireTarget(entityType: string): EntityIconTarget {
  const target = entityIconTargets[entityType]
  if (!target) {
    throw errors.BAD_REQUEST({
      message: "Este tipo de elemento no admite iconos",
    })
  }
  return target
}

async function assertWritable(context: Context, ref: EntityRef) {
  const writable = await requireTarget(ref.entityType).writable({
    context,
    entityIds: [ref.entityId],
  })
  if (!writable.has(ref.entityId)) {
    throw errors.NOT_FOUND({ message: "Elemento no encontrado" })
  }
}

function toEntityIcon(row: typeof entityIcons.$inferSelect) {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    icon: row.icon,
    color: row.color,
  }
}

/**
 * Removes the icons of deleted entities. Owners of icon-capable entities call
 * it from their delete path, passing their transaction when they have one.
 */
export async function deleteEntityIcons(
  { entityType, entityIds }: { entityType: string; entityIds: string[] },
  executor: Executor = db
) {
  if (entityIds.length === 0) return
  await executor
    .delete(entityIcons)
    .where(
      and(
        eq(entityIcons.entityType, entityType),
        inArray(entityIcons.entityId, entityIds)
      )
    )
}

export const entityIconHandler = {
  getMany: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof entityIconInput.getMany>
  }) => {
    const idsByType = new Map<string, string[]>()
    for (const { entityType, entityId } of input.entities) {
      const ids = idsByType.get(entityType) ?? []
      ids.push(entityId)
      idsByType.set(entityType, ids)
    }

    const readableByType = await Promise.all(
      [...idsByType].map(async ([entityType, entityIds]) => {
        const readable = await requireTarget(entityType).readable({
          context,
          entityIds: [...new Set(entityIds)],
        })
        return [entityType, [...readable]] as const
      })
    )

    const conditions = readableByType
      .filter(([, ids]) => ids.length > 0)
      .map(([entityType, ids]) =>
        and(
          eq(entityIcons.entityType, entityType),
          inArray(entityIcons.entityId, ids)
        )
      )
    if (conditions.length === 0) return []

    const rows = await db
      .select()
      .from(entityIcons)
      .where(or(...conditions))
    return rows.map(toEntityIcon)
  },

  set: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof entityIconInput.set>
  }) => {
    await assertWritable(context, input)

    const [row] = await db
      .insert(entityIcons)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        icon: input.icon,
        color: input.color,
        createdBy: context.user?.id ?? null,
      })
      .onConflictDoUpdate({
        target: [entityIcons.entityType, entityIcons.entityId],
        set: { icon: input.icon, color: input.color, updatedAt: new Date() },
      })
      .returning()

    if (!row) {
      throw errors.INTERNAL_SERVER_ERROR({ message: "Entity icon not saved" })
    }
    return toEntityIcon(row)
  },

  clear: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof entityIconInput.clear>
  }) => {
    await assertWritable(context, input)
    await deleteEntityIcons({
      entityType: input.entityType,
      entityIds: [input.entityId],
    })
    return { success: true }
  },
}
