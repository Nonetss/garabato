import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"

import { privateHandler } from "#v1/private/handler"
import { privateOutput } from "#v1/private/output"

export const privateRouter = {
  getPrivateData: protectedProcedure
    .meta(
      openapi({
        summary: "Get private data",
        description:
          "Returns the authenticated user along with a sample private message. Requires a session cookie, Bearer token, or an x-api-key header.",
        tags: ["User - Private", "User"],
        method: "GET",
      })
    )
    .output(privateOutput.get)
    .handler(({ context }) => {
      return privateHandler.getPrivateData({ context })
    }),
}
