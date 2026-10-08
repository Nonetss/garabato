import { entityIconColors } from "@nonete/db/schema"
import { z } from "zod"

const entityRef = {
  entityType: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .describe("Registered icon-capable entity type"),
  entityId: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .describe("Identifier of the entity the icon belongs to"),
}

export const entityIconInput = {
  getMany: z.object({
    entities: z
      .array(z.object(entityRef))
      .min(1)
      .max(100)
      .describe("Batch of entities to load icons for"),
  }),

  set: z.object({
    ...entityRef,
    icon: z
      .string()
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .describe("Lucide icon name in kebab-case (for example, book-open)"),
    color: z.enum(entityIconColors).describe("Palette key of the icon color"),
  }),

  clear: z.object({
    ...entityRef,
  }),
}
