import { beforeEach, describe, expect, test } from "bun:test"
import { CronNotFoundError } from "@nonete/cron"
import { cronJobRow } from "@nonete/db/testing"
import { ORPCError } from "@orpc/server"
import { cronService, resetCronService } from "#tests/fixtures/cron-service"
import { closeCronRunEvents, publishCronRunChange } from "#v1/cron/events"
import { cronHandler } from "#v1/cron/handler"

const JOB = "job-a"
const OTHER_JOB = "job-b"
const MISSING_JOB = "job-missing"

beforeEach(() => {
  resetCronService()
  cronService.get.mockImplementation(async (id) => {
    if (id === MISSING_JOB) {
      throw new CronNotFoundError(`Cron job not found: ${id}`)
    }
    return cronJobRow({ id })
  })
})

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
