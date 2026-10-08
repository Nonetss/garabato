import { z } from "zod"

import { paginationLimit } from "#shared/pagination"

export const logsInput = {
  query: z.object({
    userId: z.string().optional(),
    type: z.enum(["page_view", "api_call"]).optional(),
    /** Substring match against the logged path. */
    path: z.string().optional(),
    /** HTTP verb — only meaningful for `api_call` entries. */
    method: z
      .enum(["GET", "QUERY", "POST", "PUT", "PATCH", "DELETE"])
      .optional(),
    /** ISO timestamp lower bound. Defaults to 7 days ago. */
    from: z.string().optional(),
    /** ISO timestamp upper bound, exclusive. Defaults to now. */
    to: z.string().optional(),
    /** ISO timestamp cursor for "load older" pagination: entries strictly
     * before this timestamp. Takes precedence over `to` when both are set. */
    before: z.string().optional(),
    limit: paginationLimit(50, 200),
  }),
}
