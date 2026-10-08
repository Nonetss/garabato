import { z } from "zod"

const favoriteItem = z.object({
  id: z.uuid().describe("The collection item identifier"),
  entityType: z.string().describe("The polymorphic resource type"),
  entityId: z.string().describe("The resource identifier"),
  metadata: z
    .record(z.string(), z.unknown())
    .nullable()
    .describe("Optional display snapshot supplied by the resource"),
  createdAt: z.string().describe("The time the resource was favorited"),
})

const collectionSummary = z.object({
  id: z.uuid().describe("The collection identifier"),
  kind: z.string().describe("Collection behavior, such as favorites or custom"),
  name: z.string().nullable().describe("The collection name, when applicable"),
  description: z
    .string()
    .nullable()
    .describe("The collection description, when one was written"),
  createdAt: z.string().describe("The time the collection was created"),
  updatedAt: z.string().describe("The time the collection was last updated"),
})

const collectionItem = z.object({
  id: z.uuid().describe("The collection item identifier"),
  collectionId: z.uuid().describe("The collection that owns the item"),
  entityType: z.string().describe("The polymorphic resource type"),
  entityId: z.string().describe("The resource identifier"),
  metadata: z
    .record(z.string(), z.unknown())
    .nullable()
    .describe("Optional display snapshot supplied by the resource"),
  createdAt: z.string().describe("The time the resource was added"),
})

export const collectionOutput = {
  list: z.array(collectionSummary).describe("Collections owned by the user"),
  create: collectionSummary,
  update: collectionSummary,
  delete: z.object({ id: z.uuid(), success: z.boolean() }),
  listItems: z.array(collectionItem).describe("Resources in a collection"),
  updateItem: collectionItem,
  addItem: collectionItem.extend({
    created: z.boolean().describe("Whether the item was newly added"),
  }),
  removeItem: z.object({
    collectionId: z.uuid(),
    entityType: z.string(),
    entityId: z.string(),
    success: z.boolean(),
  }),
  itemCollections: z
    .array(collectionSummary)
    .describe("User collections containing a resource"),
  listFavorites: z
    .array(favoriteItem)
    .describe("Resources in the authenticated user's favorites collection"),
  addFavorite: favoriteItem.extend({
    created: z
      .boolean()
      .describe("Whether the resource was newly added to favorites"),
  }),
  removeFavorite: z.object({
    entityType: z.string().describe("The polymorphic resource type"),
    entityId: z.string().describe("The resource identifier"),
    success: z
      .boolean()
      .describe("Whether the resource is absent from favorites"),
  }),
  favoriteStatuses: z.array(
    z.object({
      entityType: z.string().describe("The polymorphic resource type"),
      entityId: z.string().describe("The resource identifier"),
      favorited: z.boolean().describe("Whether the resource is favorited"),
    })
  ),
}
