import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"

import { traceHandler } from "#v1/trace/handler"
import { traceInput } from "#v1/trace/input"
import { traceOutput } from "#v1/trace/output"

export const traceRouter = {
  list: protectedProcedure
    .meta(
      openapi({
        summary: "List my trail",
        description:
          "Returns the caller's trail, newest first and paginated by cursor: every traced action on their certificates and documents (imports, renames, remembered and forgotten passwords, deletions, uploads, merges, page edits, downloads and moves) plus each signature record as a `document.signed` entry, including entries of deleted documents and certificates. Optional filters: types to include or exclude, certificate, text the document name or certificate alias contains, and an interval (`from` inclusive, `before` exclusive). `total` counts every matching entry.",
        tags: ["Traces"],
        method: "GET",
      })
    )
    .input(traceInput.list)
    .output(traceOutput.list)
    .handler(({ context, input }) => traceHandler.list({ context, input })),

  certificates: protectedProcedure
    .meta(
      openapi({
        summary: "List the certificates of my trail",
        description:
          "Returns every certificate of the caller, deleted ones included, ordered by alias. Meant for the trail's certificate filter.",
        tags: ["Traces"],
        method: "GET",
      })
    )
    .output(traceOutput.certificates)
    .handler(({ context }) => traceHandler.certificates({ context })),
}
