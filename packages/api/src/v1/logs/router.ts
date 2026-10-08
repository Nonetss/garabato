import { openapi } from "@orpc/openapi"
import { adminProcedure } from "#index"

import { logsHandler } from "#v1/logs/handler"
import { logsInput } from "#v1/logs/input"
import { logsOutput } from "#v1/logs/output"

export const logsRouter = {
  query: adminProcedure
    .meta(
      openapi({
        summary: "Query activity log",
        description:
          "Returns a filterable, administrator-only page of page-view and API-call log entries indexed in Loki.",
        tags: ["Admin - Logs", "Admin"],
        method: "GET",
      })
    )
    .input(logsInput.query)
    .output(logsOutput.query)
    .handler(({ input }) => logsHandler.query({ input })),
}
