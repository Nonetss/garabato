import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import {
  createFakeDb,
  cronJobRow,
  cronRunRow,
  stepArgs,
} from "@nonete/db/testing"

import { CronNotFoundError, CronValidationError } from "#errors"
import {
  type CronRunChange,
  type CronScheduler,
  createScheduler,
  recoverOrphanedRuns,
} from "#scheduler"
import { installFakeBunCron } from "#tests/fixtures/bun-cron"
import { silentLogger } from "#tests/fixtures/logger"

const HOUR_MS = 60 * 60 * 1000

const fake = createFakeDb()
const resolve = mock(
  async (_key: string, _ctx: unknown): Promise<unknown> => ({ ok: true })
)
let bunCron: ReturnType<typeof installFakeBunCron>
let scheduler: CronScheduler
let changes: CronRunChange[] = []
let onRunChange = mock((change: CronRunChange) => {
  changes.push(change)
})

function build() {
  return createScheduler({
    db: fake.db,
    resolve,
    logger: silentLogger(),
    pollIntervalMs: HOUR_MS,
    onRunChange: (change) => onRunChange(change),
  })
}

/** Resolves once the listener has seen a run reach `status`. */
function waitForStatus(status: CronRunChange["status"]) {
  return new Promise<CronRunChange>((done) => {
    const listener = onRunChange
    onRunChange = mock((change: CronRunChange) => {
      listener(change)
      if (change.status === status) done(change)
    })
  })
}

/** The `set(...)` payload of each recorded update. */
function updates() {
  return fake.calls("update").map((call) => stepArgs(call, "set")[0])
}

beforeEach(() => {
  fake.reset()
  resolve.mockReset()
  resolve.mockResolvedValue({ ok: true })
  changes = []
  onRunChange = mock((change: CronRunChange) => {
    changes.push(change)
  })
  bunCron = installFakeBunCron()
  scheduler = build()
})

afterEach(async () => {
  await scheduler.stop()
  bunCron.restore()
})

const jobA = cronJobRow({ id: "job-a", name: "A", cronExpression: "0 1 * * *" })
const jobB = cronJobRow({ id: "job-b", name: "B", cronExpression: "0 2 * * *" })

describe("scheduler lifecycle", () => {
  test("start schedules each enabled job once and is idempotent", async () => {
    fake.queue("query.cronJob.findMany", [jobA, jobB])
    fake.queue("update", [], [])

    await scheduler.start()
    await scheduler.start()

    expect(bunCron.active().map((job) => job.expression)).toEqual([
      "0 1 * * *",
      "0 2 * * *",
    ])
    expect(fake.calls("query.cronJob.findMany")).toHaveLength(1)
    expect(updates()).toEqual([
      { nextRunAt: expect.any(Date) },
      { nextRunAt: expect.any(Date) },
    ])
  })

  test("refresh reschedules a changed job and unschedules a disabled one", async () => {
    fake.queue("query.cronJob.findMany", [jobA, jobB])
    fake.queue("update", [], [])
    await scheduler.start()

    fake.queue("query.cronJob.findMany", [
      { ...jobA, cronExpression: "30 1 * * *" },
    ])
    fake.queue("update", [])
    await scheduler.refresh()

    expect(bunCron.active().map((job) => job.expression)).toEqual([
      "30 1 * * *",
    ])
  })

  test("refresh keeps an unchanged job scheduled as is", async () => {
    fake.queue("query.cronJob.findMany", [jobA], [jobA])
    fake.queue("update", [])
    await scheduler.start()
    await scheduler.refresh()

    expect(bunCron.jobs).toHaveLength(1)
    expect(bunCron.active()).toHaveLength(1)
  })

  test("stop stops every scheduled job", async () => {
    fake.queue("query.cronJob.findMany", [jobA, jobB])
    fake.queue("update", [], [])
    await scheduler.start()

    await scheduler.stop()

    expect(bunCron.jobs).toHaveLength(2)
    expect(bunCron.active()).toEqual([])
  })
})

describe("scheduler runNow", () => {
  test("fails with CronNotFoundError for a missing job", async () => {
    fake.queue("query.cronJob.findFirst", undefined)
    await expect(scheduler.runNow("missing")).rejects.toThrow(CronNotFoundError)
  })

  test("fails with CronValidationError while a run is in progress", async () => {
    fake.queue("query.cronJob.findFirst", jobA)
    fake.queue("query.cronRun.findFirst", cronRunRow({ jobId: jobA.id }))

    await expect(scheduler.runNow(jobA.id)).rejects.toThrow(CronValidationError)
    expect(fake.calls("insert")).toEqual([])
  })

  test("records a running run, then finishes it as success", async () => {
    const run = cronRunRow({ id: "run-ok", jobId: jobA.id })
    fake.queue("query.cronJob.findFirst", jobA)
    fake.queue("query.cronRun.findFirst", undefined)
    fake.queue("insert", [run])
    fake.queue("update", [], [])
    const finished = waitForStatus("success")

    expect(await scheduler.runNow(jobA.id)).toEqual(run)
    await finished

    expect(resolve).toHaveBeenCalledWith(jobA.handlerKey, {
      jobId: jobA.id,
      jobName: jobA.name,
      userId: null,
      payload: null,
    })
    expect(updates()).toEqual([
      { status: "success", finishedAt: expect.any(Date), result: { ok: true } },
      { lastRunAt: run.startedAt, nextRunAt: expect.any(Date) },
    ])
    expect(changes.map((change) => change.status)).toEqual([
      "running",
      "success",
    ])
  })

  test("marks the run failed when the resolver rejects", async () => {
    const run = cronRunRow({ id: "run-ko", jobId: jobA.id })
    resolve.mockRejectedValue(new Error("boom"))
    fake.queue("query.cronJob.findFirst", jobA)
    fake.queue("query.cronRun.findFirst", undefined)
    fake.queue("insert", [run])
    fake.queue("update", [], [])
    const finished = waitForStatus("failed")

    await scheduler.runNow(jobA.id)
    await finished

    expect(updates()[0]).toEqual({
      status: "failed",
      finishedAt: expect.any(Date),
      errorMessage: "boom",
    })
  })

  test("a failing listener doesn't affect the run", async () => {
    const run = cronRunRow({ id: "run-ok", jobId: jobA.id })
    fake.queue("query.cronJob.findFirst", jobA)
    fake.queue("query.cronRun.findFirst", undefined)
    fake.queue("insert", [run])
    fake.queue("update", [], [])
    onRunChange = mock((change: CronRunChange) => {
      changes.push(change)
      if (change.status === "running") throw new Error("listener down")
    })
    const finished = waitForStatus("success")

    await scheduler.runNow(jobA.id)
    await finished

    expect(updates()[0]).toMatchObject({ status: "success" })
  })
})

describe("scheduled fire", () => {
  test("runs the job when its schedule fires", async () => {
    fake.queue("query.cronJob.findMany", [jobA])
    fake.queue("update", [])
    await scheduler.start()

    fake.queue("query.cronJob.findFirst", jobA)
    fake.queue("query.cronRun.findFirst", undefined)
    fake.queue("insert", [cronRunRow({ jobId: jobA.id })])
    fake.queue("update", [], [])
    await bunCron.jobs[0]?.fire()

    expect(resolve).toHaveBeenCalledTimes(1)
    expect(updates()[1]).toMatchObject({ status: "success" })
  })

  test("records a skipped run while the previous one is still running", async () => {
    fake.queue("query.cronJob.findMany", [jobA])
    fake.queue("update", [])
    await scheduler.start()

    fake.queue("query.cronJob.findFirst", jobA)
    fake.queue("query.cronRun.findFirst", cronRunRow({ jobId: jobA.id }))
    fake.queue("insert", [{ id: "run-skipped" }])
    await bunCron.jobs[0]?.fire()

    const [insert] = fake.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toMatchObject({
      status: "skipped",
      errorMessage: "Previous run still in progress",
    })
    expect(resolve).not.toHaveBeenCalled()
  })
})

describe("recoverOrphanedRuns", () => {
  test("marks running rows as failed", async () => {
    fake.queue("update", [{ id: "run-1" }])

    await recoverOrphanedRuns(fake.db, silentLogger())

    expect(updates()).toEqual([
      {
        status: "failed",
        finishedAt: expect.any(Date),
        errorMessage: "Process restarted while run was in progress",
      },
    ])
  })
})
