import { openapi } from "@orpc/openapi"
import { publicProcedure } from "#index"
import { healthHandler } from "#v1/health/handler"
import { healthOutput } from "#v1/health/output"

export const healthRouter = {
  check: publicProcedure
    .meta(
      openapi({
        summary: "Health check",
        description: "Returns OK when the server is up and reachable.",
        tags: ["System - Health", "System"],
        method: "GET",
      })
    )
    .output(healthOutput.check)
    .handler(() => {
      return healthHandler.check()
    }),
}
