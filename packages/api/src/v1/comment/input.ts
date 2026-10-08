import { z } from "zod"

const entityRef = {
  entityType: z
    .string()
    .min(1)
    .max(64)
    .describe("Polymorphic entity type (e.g. door, organization)"),
  entityId: z.uuid().describe("UUID of the entity this comment belongs to"),
}

export const commentInput = {
  list: z.object({
    ...entityRef,
  }),

  counts: z.object({
    entities: z
      .array(z.object(entityRef))
      .min(1)
      .max(100)
      .describe("Batch of entities to count comments for"),
  }),

  create: z.object({
    ...entityRef,
    content: z.string().trim().min(1).max(4000),
    parentId: z
      .uuid()
      .optional()
      .describe("Parent comment id when posting a reply"),
  }),

  update: z.object({
    id: z.uuid(),
    content: z.string().trim().min(1).max(4000),
  }),

  delete: z.object({
    id: z.uuid(),
  }),
}
