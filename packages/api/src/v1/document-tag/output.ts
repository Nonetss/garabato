import { entityIconColors } from "@nonete/db/schema"
import { z } from "zod"

const tag = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.enum(entityIconColors),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const listedTag = tag.extend({
  documentCount: z
    .number()
    .int()
    .describe("Documents carrying the tag, deleted ones excluded"),
})

export type DocumentTagOutput = z.infer<typeof tag>
export type ListedDocumentTag = z.infer<typeof listedTag>

export const documentTagOutput = {
  list: z.array(listedTag),
  create: tag,
  update: tag,
  delete: z.object({ id: z.uuid(), success: z.boolean() }),
}
