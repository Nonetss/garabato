import { z } from "zod"

export const pluginsOutput = {
  list: z.array(
    z.object({
      id: z.string().describe("The plugin id as registered in Better Auth"),
    })
  ),
}
