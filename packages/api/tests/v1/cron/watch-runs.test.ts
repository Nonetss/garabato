import { describe, expect, mock, test } from "bun:test"
import { CronNotFoundError } from "@nonete/cron"
import { ORPCError } from "@orpc/server"

const JOB = "job-a"
const OTHER_JOB = "job-b"
const MISSING_JOB = "job-missing"

// Replaced before the handler loads: the real service is bound by the backend
// at startup and talks to the database.
mock.module("#v1/cron/runtime", () => ({
  getCronService: () => ({
    get: async (id: string) => {
      if (id === MISSING_JOB) {
        throw new CronNotFoundError(`Cron job not found: ${id}`)
      }
      return { id }
    },
  }),
}))

const { cronHandler } = await import("#v1/cron/handler")
const { closeCronRunEvents, publishCronRunChange } = await import(
  "#v1/cron/events"
)

function watch(jobId: string, signal?: AbortSignal) {
  return cronHandler.watchRuns({ input: { jobId }, signal })
}

describe("cron.watchRuns", () => {
  test("fails with NOT_FOUND for an unknown job", async () => {
    const error = await watch(MISSING_JOB)
      .next()
      .then(
        () => undefined,
        (thrown: unknown) => thrown
      )
    expect(error).toBeInstanceOf(ORPCError)
    if (error instanceof ORPCError) expect(error.code).toBe("NOT_FOUND")
  })

  test("sends subscribed first, then only the job's own run changes", async () => {
    const controller = new AbortController()
    const events = watch(JOB, controller.signal)

    expect((await events.next()).value).toEqual({ type: "subscribed" })

    await publishCronRunChange({
      jobId: OTHER_JOB,
      runId: "run-other",
      status: "running",
    })
    await publishCronRunChange({
      jobId: JOB,
      runId: "run-1",
      status: "running",
    })
    await publishCronRunChange({
      jobId: JOB,
      runId: "run-1",
      status: "success",
    })

    expect((await events.next()).value).toEqual({
      type: "run",
      runId: "run-1",
      status: "running",
    })
    expect((await events.next()).value).toEqual({
      type: "run",
      runId: "run-1",
      status: "success",
    })

    controller.abort()
    expect((await events.next()).done).toBe(true)
  })

  // Last on purpose: the shutdown signal stays aborted for the whole process.
  test("ends open streams when the backend shuts down", async () => {
    const events = watch(JOB)
    expect((await events.next()).value).toEqual({ type: "subscribed" })

    const next = events.next()
    closeCronRunEvents()
    expect((await next).done).toBe(true)

    expect((await watch(JOB).next()).done).toBe(true)
  })
})
