import { z } from "zod"

export const releaseOutput = {
  status: z.object({
    current: z.string().describe("Version this Garabato runs, e.g. 0.3.1"),
    update: z
      .object({
        version: z.string().describe("Version of the newer release"),
        url: z.string().describe("The release's page on GitHub"),
        publishedAt: z.string().describe("When the release was published"),
      })
      .nullable()
      .describe(
        "The latest GitHub release when it is newer than the running version; always null for non-admins"
      ),
  }),
}
