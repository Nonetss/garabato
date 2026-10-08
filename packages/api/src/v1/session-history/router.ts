import { openapi } from "@orpc/openapi"
import { adminProcedure } from "#index"

import { sessionHistoryHandler } from "#v1/session-history/handler"
import { sessionHistoryInput } from "#v1/session-history/input"
import { sessionHistoryOutput } from "#v1/session-history/output"

export const sessionHistoryRouter = {
  list: adminProcedure
    .meta(
      openapi({
        summary: "List session history",
        description:
          "Returns a paginated, administrator-only audit history of stored sessions. Session tokens are never returned.",
        tags: ["Admin - Session History", "Admin"],
        method: "GET",
      })
    )
    .input(sessionHistoryInput.list)
    .output(sessionHistoryOutput.list)
    .handler(({ context, input }) =>
      sessionHistoryHandler.list({ context, input })
    ),
}
