import { z } from "zod"

const logEntry = z.object({
  timestamp: z.string(),
  level: z.string(),
  service: z.string(),
  type: z.enum(["page_view", "api_call"]),
  message: z.string(),
  userId: z.string().nullable(),
  path: z.string().nullable(),
  method: z.string().nullable(),
  statusCode: z.number().nullable(),
  /** Everything else pino attached to the line, for the expandable
   * "raw payload" view. */
  raw: z.record(z.string(), z.unknown()),
})

export const logsOutput = {
  query: z.object({
    entries: z.array(logEntry),
    /** Opaque cursor (an entry timestamp) for the next page's `before`
     * input; `null` when there are no older entries. */
    nextCursor: z.string().nullable(),
  }),
}
