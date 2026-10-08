import { entityIconColors } from "@nonete/db/schema"
import { z } from "zod"

const id = z.uuid()

const name = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .describe("Tag name; unique among the caller's tags, ignoring case")

const color = z
  .enum(entityIconColors)
  .describe("Palette key of the tag color (the entity icon palette)")

export const documentTagInput = {
  create: z.object({
    name,
    color: color.optional().describe("Palette key; `neutral` when omitted"),
  }),

  update: z
    .object({ id, name: name.optional(), color: color.optional() })
    .refine(
      (input) => input.name !== undefined || input.color !== undefined,
      "Pass a name, a color or both"
    ),

  delete: z.object({ id }),
}
