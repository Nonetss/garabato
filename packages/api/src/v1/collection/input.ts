import { z } from "zod"

const entityRef = {
  entityType: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/)
    .describe("Stable polymorphic resource type (for example, cron-job)"),
  entityId: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe("Opaque identifier of the resource"),
}

const collectionId = z.uuid().describe("Collection identifier")

const collectionName = z
  .string()
  .trim()
  .min(1, "El nombre de la colección es obligatorio")
  .max(120, "El nombre de la colección no puede superar 120 caracteres")
  .describe("User-visible name for a custom collection")

const collectionDescription = z
  .string()
  .trim()
  .max(500, "La descripción no puede superar 500 caracteres")
  .nullable()
  .optional()
  .describe(
    "Optional summary of a custom collection; empty or null clears it, omitted keeps it"
  )

const collectionItemMetadata = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(1000).optional(),
    href: z.string().trim().max(2000).optional(),
    image: z.string().trim().max(2000).optional(),
  })
  .passthrough()
  .optional()

export const collectionInput = {
  create: z.object({
    name: collectionName,
    description: collectionDescription,
  }),
  update: z.object({
    id: collectionId,
    name: collectionName,
    description: collectionDescription,
  }),
  delete: z.object({ id: collectionId }),
  listItems: z.object({ collectionId }),
  updateItem: z.object({
    id: z.uuid().describe("Collection item identifier"),
    metadata: collectionItemMetadata,
  }),
  addItem: z.object({
    collectionId,
    ...entityRef,
    metadata: collectionItemMetadata,
  }),
  removeItem: z.object({ collectionId, ...entityRef }),
  itemCollections: z.object(entityRef),
  addFavorite: z.object({ ...entityRef, metadata: collectionItemMetadata }),
  removeFavorite: z.object(entityRef),
  favoriteStatuses: z.object({
    entities: z
      .array(z.object(entityRef))
      .min(1)
      .max(100)
      .describe("Resources whose favorite status should be returned"),
  }),
}
