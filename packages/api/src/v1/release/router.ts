import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"
import { releaseHandler } from "#v1/release/handler"
import { releaseOutput } from "#v1/release/output"

export const releaseRouter = {
  status: protectedProcedure
    .meta(
      openapi({
        summary: "Get the running version and any newer release",
        description:
          "Returns the version this Garabato runs. For administrators it also returns the latest GitHub release when it is newer, looked up at most every few hours; null when there is none or GitHub cannot be reached.",
        tags: ["System - Release", "System"],
        method: "GET",
      })
    )
    .output(releaseOutput.status)
    .handler(({ context }) => releaseHandler.status({ context })),
}
