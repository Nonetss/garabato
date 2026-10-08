import { z } from "zod"

const id = z.uuid()

const name = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe("Folder name; unique among its siblings, ignoring case")

export const documentFolderInput = {
  create: z.object({
    name,
    parentId: id
      .optional()
      .describe("Folder to create it in; the library root when omitted"),
  }),

  rename: z.object({ id, name }),

  move: z.object({
    id,
    parentId: id
      .nullable()
      .describe("New parent folder, or null for the library root"),
  }),

  delete: z.object({ id }),
}
