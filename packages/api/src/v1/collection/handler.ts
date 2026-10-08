import { db } from "@nonete/db"
import { collection, collectionItem } from "@nonete/db/schema"
import { and, desc, eq, inArray } from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { toIso } from "#shared/dates"
import type { collectionInput } from "#v1/collection/input"
import { deleteEntityIcons } from "#v1/entity-icon/handler"

type CollectionSummaryRow = Pick<
  typeof collection.$inferSelect,
  "id" | "kind" | "name" | "description" | "createdAt" | "updatedAt"
>

function toCollection(row: CollectionSummaryRow) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

function toCollectionItem(row: typeof collectionItem.$inferSelect) {
  return {
    id: row.id,
    collectionId: row.collectionId,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    createdAt: toIso(row.createdAt),
  }
}

async function findOwnedCollection(id: string, ownerId: string) {
  const [ownedCollection] = await db
    .select()
    .from(collection)
    .where(and(eq(collection.id, id), eq(collection.ownerId, ownerId)))
    .limit(1)

  if (!ownedCollection) {
    throw errors.NOT_FOUND({ message: "Colección no encontrada" })
  }

  return ownedCollection
}

function requireCustomCollection(row: typeof collection.$inferSelect) {
  if (row.kind !== "custom") {
    throw errors.CONFLICT({
      message: "La colección de favoritos no se puede modificar así",
    })
  }
}

async function findFavoritesCollection(ownerId: string) {
  const [favoriteCollection] = await db
    .select()
    .from(collection)
    .where(
      and(eq(collection.ownerId, ownerId), eq(collection.kind, "favorites"))
    )
    .limit(1)

  return favoriteCollection
}

async function findOrCreateFavoritesCollection(ownerId: string) {
  const existing = await findFavoritesCollection(ownerId)
  if (existing) return existing

  // The partial unique index keeps concurrent requests to one favorites
  // collection per user. A conflicting insertion simply re-reads that row.
  await db
    .insert(collection)
    .values({ ownerId, kind: "favorites", name: "Favoritos" })
    .onConflictDoNothing()

  const favoriteCollection = await findFavoritesCollection(ownerId)
  if (!favoriteCollection) {
    throw errors.INTERNAL_SERVER_ERROR({
      message: "No se pudo crear la colección de favoritos",
    })
  }

  return favoriteCollection
}

function requireUserId(context: Context) {
  if (!context.user) throw errors.UNAUTHORIZED()
  return context.user.id
}

export const collectionHandler = {
  listFavorites: async ({ context }: { context: Context }) => {
    const favoriteCollection = await findFavoritesCollection(
      requireUserId(context)
    )
    if (!favoriteCollection) return []

    const items = await db
      .select()
      .from(collectionItem)
      .where(eq(collectionItem.collectionId, favoriteCollection.id))
      .orderBy(desc(collectionItem.createdAt))

    return items.map(toCollectionItem)
  },

  list: async ({ context }: { context: Context }) => {
    const collections = await db
      .select()
      .from(collection)
      .where(eq(collection.ownerId, requireUserId(context)))
      .orderBy(desc(collection.updatedAt))

    return collections.map(toCollection)
  },

  create: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.create>
  }) => {
    const [created] = await db
      .insert(collection)
      .values({
        ownerId: requireUserId(context),
        kind: "custom",
        name: input.name,
        description: input.description || null,
      })
      .returning()

    if (!created) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "No se pudo crear la colección",
      })
    }

    return toCollection(created)
  },

  update: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.update>
  }) => {
    const ownedCollection = await findOwnedCollection(
      input.id,
      requireUserId(context)
    )
    requireCustomCollection(ownedCollection)

    const [updated] = await db
      .update(collection)
      .set({
        name: input.name,
        // Omitted keeps the current description; an empty one clears it.
        ...(input.description !== undefined && {
          description: input.description || null,
        }),
      })
      .where(eq(collection.id, ownedCollection.id))
      .returning()

    if (!updated) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "No se pudo actualizar la colección",
      })
    }

    return toCollection(updated)
  },

  delete: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.delete>
  }) => {
    const ownedCollection = await findOwnedCollection(
      input.id,
      requireUserId(context)
    )
    requireCustomCollection(ownedCollection)

    await db.transaction(async (tx) => {
      await deleteEntityIcons(
        { entityType: "collection", entityIds: [ownedCollection.id] },
        tx
      )
      await tx.delete(collection).where(eq(collection.id, ownedCollection.id))
    })
    return { id: ownedCollection.id, success: true }
  },

  listItems: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.listItems>
  }) => {
    const ownedCollection = await findOwnedCollection(
      input.collectionId,
      requireUserId(context)
    )
    const items = await db
      .select()
      .from(collectionItem)
      .where(eq(collectionItem.collectionId, ownedCollection.id))
      .orderBy(desc(collectionItem.createdAt))

    return items.map(toCollectionItem)
  },

  updateItem: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.updateItem>
  }) => {
    const [ownedItem] = await db
      .select({ item: collectionItem })
      .from(collectionItem)
      .innerJoin(collection, eq(collection.id, collectionItem.collectionId))
      .where(
        and(
          eq(collectionItem.id, input.id),
          eq(collection.ownerId, requireUserId(context))
        )
      )
      .limit(1)

    if (!ownedItem) {
      throw errors.NOT_FOUND({ message: "Recurso guardado no encontrado" })
    }

    const [updated] = await db
      .update(collectionItem)
      .set({ metadata: input.metadata ?? null })
      .where(eq(collectionItem.id, input.id))
      .returning()

    if (!updated) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "No se pudo actualizar la información del recurso",
      })
    }

    return toCollectionItem(updated)
  },

  addItem: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.addItem>
  }) => {
    const ownedCollection = await findOwnedCollection(
      input.collectionId,
      requireUserId(context)
    )
    const [inserted] = await db
      .insert(collectionItem)
      .values({
        collectionId: ownedCollection.id,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      })
      .onConflictDoNothing()
      .returning()

    if (inserted) return { ...toCollectionItem(inserted), created: true }

    const [existing] = await db
      .select()
      .from(collectionItem)
      .where(
        and(
          eq(collectionItem.collectionId, ownedCollection.id),
          eq(collectionItem.entityType, input.entityType),
          eq(collectionItem.entityId, input.entityId)
        )
      )
      .limit(1)

    if (!existing) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "No se pudo añadir el recurso a la colección",
      })
    }

    return { ...toCollectionItem(existing), created: false }
  },

  removeItem: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.removeItem>
  }) => {
    const ownedCollection = await findOwnedCollection(
      input.collectionId,
      requireUserId(context)
    )
    await db
      .delete(collectionItem)
      .where(
        and(
          eq(collectionItem.collectionId, ownedCollection.id),
          eq(collectionItem.entityType, input.entityType),
          eq(collectionItem.entityId, input.entityId)
        )
      )

    return { ...input, success: true }
  },

  itemCollections: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.itemCollections>
  }) => {
    const collections = await db
      .select({
        id: collection.id,
        kind: collection.kind,
        name: collection.name,
        description: collection.description,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      })
      .from(collection)
      .innerJoin(collectionItem, eq(collection.id, collectionItem.collectionId))
      .where(
        and(
          eq(collection.ownerId, requireUserId(context)),
          eq(collectionItem.entityType, input.entityType),
          eq(collectionItem.entityId, input.entityId)
        )
      )
      .orderBy(desc(collection.updatedAt))

    return collections.map(toCollection)
  },

  addFavorite: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.addFavorite>
  }) => {
    const favoriteCollection = await findOrCreateFavoritesCollection(
      requireUserId(context)
    )
    const [inserted] = await db
      .insert(collectionItem)
      .values({
        collectionId: favoriteCollection.id,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      })
      .onConflictDoNothing()
      .returning()

    if (inserted) return { ...toCollectionItem(inserted), created: true }

    const [existing] = await db
      .select()
      .from(collectionItem)
      .where(
        and(
          eq(collectionItem.collectionId, favoriteCollection.id),
          eq(collectionItem.entityType, input.entityType),
          eq(collectionItem.entityId, input.entityId)
        )
      )
      .limit(1)

    if (!existing) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "No se pudo añadir el recurso a favoritos",
      })
    }

    return { ...toCollectionItem(existing), created: false }
  },

  removeFavorite: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.removeFavorite>
  }) => {
    const favoriteCollection = await findFavoritesCollection(
      requireUserId(context)
    )
    if (favoriteCollection) {
      await db
        .delete(collectionItem)
        .where(
          and(
            eq(collectionItem.collectionId, favoriteCollection.id),
            eq(collectionItem.entityType, input.entityType),
            eq(collectionItem.entityId, input.entityId)
          )
        )
    }

    return { ...input, success: true }
  },

  favoriteStatuses: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof collectionInput.favoriteStatuses>
  }) => {
    const favoriteCollection = await findFavoritesCollection(
      requireUserId(context)
    )
    if (!favoriteCollection) {
      return input.entities.map((entity) => ({ ...entity, favorited: false }))
    }

    const entityTypes = [...new Set(input.entities.map((e) => e.entityType))]
    const entityIds = [...new Set(input.entities.map((e) => e.entityId))]
    const items = await db
      .select({
        entityType: collectionItem.entityType,
        entityId: collectionItem.entityId,
      })
      .from(collectionItem)
      .where(
        and(
          eq(collectionItem.collectionId, favoriteCollection.id),
          inArray(collectionItem.entityType, entityTypes),
          inArray(collectionItem.entityId, entityIds)
        )
      )

    const favoriteKeys = new Set(
      items.map((item) => `${item.entityType}:${item.entityId}`)
    )
    return input.entities.map((entity) => ({
      ...entity,
      favorited: favoriteKeys.has(`${entity.entityType}:${entity.entityId}`),
    }))
  },
}
