import { z } from "zod"

const folder = z.object({
  id: z.uuid(),
  name: z.string(),
  parentId: z.uuid().nullable().describe("Null for a top-level folder"),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const listedFolder = folder.extend({
  documentCount: z
    .number()
    .int()
    .describe("Documents directly inside, deleted ones excluded"),
})

export type DocumentFolderOutput = z.infer<typeof folder>
export type ListedDocumentFolder = z.infer<typeof listedFolder>

export const documentFolderOutput = {
  list: z.array(listedFolder),
  create: folder,
  rename: folder,
  move: folder,
  delete: z.object({ id: z.uuid(), success: z.boolean() }),
}
