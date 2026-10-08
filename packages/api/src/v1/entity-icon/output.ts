import { entityIconColors } from "@nonete/db/schema"
import { z } from "zod"

const entityIcon = z.object({
  entityType: z.string(),
  entityId: z.string(),
  icon: z.string().describe("Lucide icon name in kebab-case"),
  color: z.enum(entityIconColors).describe("Palette key of the icon color"),
})

export const entityIconOutput = {
  getMany: z
    .array(entityIcon)
    .describe("Icons of the requested entities that have one and are readable"),

  set: entityIcon,

  clear: z.object({
    success: z.boolean(),
  }),
}
