import { eventIterator } from "@orpc/server"
import { z } from "zod"

const cronJob = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  cronExpression: z.string(),
  timezone: z.string(),
  enabled: z.boolean(),
  handlerKey: z.string(),
  source: z
    .enum(["manual", "code"])
    .describe(
      "`code` jobs come from a procedure's `cron.schedule` meta and are read-only"
    ),
  tags: z
    .array(z.string())
    .describe("Route tags of the procedure behind the job"),
  userId: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const runStatus = z.enum(["running", "success", "failed", "skipped"])

const cronRun = z.object({
  id: z.uuid(),
  jobId: z.uuid(),
  status: runStatus,
  handlerKey: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  result: z.unknown().nullable(),
})

/** One event of `watchRuns`. */
const runEvent = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("subscribed") })
    .describe(
      "Sent once the stream is listening. Refetch the job and its runs: anything that changed before this point is not replayed"
    ),
  z
    .object({
      type: z.literal("run"),
      runId: z.uuid(),
      status: runStatus,
    })
    .describe("A run of the job started, finished or was skipped"),
])

export const cronOutput = {
  job: cronJob,
  list: z.array(cronJob),
  run: cronRun,
  runs: z.object({
    runs: z.array(cronRun),
    nextCursor: z.string().nullable(),
  }),
  handlers: z.array(
    z.object({
      key: z.string(),
      summary: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()),
      inputSchema: z.record(z.string(), z.unknown()).nullable(),
    })
  ),
  removed: z.object({ id: z.uuid() }),
  runEvent,
  watchRuns: eventIterator(runEvent),
}
