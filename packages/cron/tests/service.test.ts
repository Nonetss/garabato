import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  createFakeDb,
  cronJobRow,
  cronRunRow,
  stepArgs,
} from "@nonete/db/testing"

import {
  CronNotFoundError,
  CronReadOnlyError,
  CronValidationError,
} from "#errors"
import { type CreateCronJobInput, createCronService } from "#service"

const fake = createFakeDb()
const onChange = mock(async () => {})
const triggerRun = mock(async (id: string) => cronRunRow({ jobId: id }))

const service = createCronService({
  db: fake.db,
  onChange,
  isValidHandlerKey: (key) => key.startsWith("v1."),
  triggerRun,
})

const input: CreateCronJobInput = {
  name: "Nightly cleanup",
  cronExpression: "0 3 * * *",
  timezone: "UTC",
  enabled: false,
  handlerKey: "v1.maintenance.cleanup",
}

const codeJob = cronJobRow({ id: "job-code", source: "code" })

beforeEach(() => {
  fake.reset()
  onChange.mockClear()
  triggerRun.mockClear()
})

describe("cron service create", () => {
  test("inserts the job and notifies the change", async () => {
    const row = cronJobRow({ enabled: false })
    fake.queue("insert", [row])

    expect(await service.create(input)).toEqual(row)
    const [insert] = fake.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toMatchObject({
      name: input.name,
      enabled: false,
      nextRunAt: null,
      userId: null,
    })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test.each([
    ["an invalid expression", { cronExpression: "nope" }],
    ["a non-UTC timezone", { timezone: "Europe/Madrid" }],
    ["an unknown handler key", { handlerKey: "unknown.key" }],
  ])("rejects %s before writing", async (_, patch) => {
    await expect(service.create({ ...input, ...patch })).rejects.toThrow(
      CronValidationError
    )
    expect(fake.calls("insert")).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
  })

  test("turns a duplicate name into a validation error", async () => {
    fake.queueError(
      "insert",
      new Error("duplicate", { cause: { code: "23505" } })
    )

    await expect(service.create(input)).rejects.toThrow(
      `A cron job named "${input.name}" already exists`
    )
  })
})

describe("cron service reads", () => {
  test("get fails with CronNotFoundError for a missing job", async () => {
    fake.queue("query.cronJob.findFirst", undefined)
    await expect(service.get("missing")).rejects.toThrow(CronNotFoundError)
  })

  test("getRun fails with CronNotFoundError for a missing run", async () => {
    fake.queue("query.cronRun.findFirst", undefined)
    await expect(service.getRun("missing")).rejects.toThrow(CronNotFoundError)
  })
})

describe("cron service mutations", () => {
  test("update writes only the given fields plus nextRunAt", async () => {
    const existing = cronJobRow({ enabled: true })
    const updated = cronJobRow({ name: "Renamed" })
    fake.queue("query.cronJob.findFirst", existing)
    fake.queue("update", [updated])

    expect(await service.update(existing.id, { name: "Renamed" })).toEqual(
      updated
    )
    const [update] = fake.calls("update")
    expect(update && stepArgs(update, "set")[0]).toEqual({
      name: "Renamed",
      nextRunAt: expect.any(Date),
    })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test("update rejects an invalid expression before writing", async () => {
    fake.queue("query.cronJob.findFirst", cronJobRow())

    await expect(
      service.update("job-1", { cronExpression: "nope" })
    ).rejects.toThrow(CronValidationError)
    expect(fake.calls("update")).toEqual([])
  })

  test("remove soft-deletes the job", async () => {
    fake.queue("query.cronJob.findFirst", cronJobRow())
    fake.queue("update", [])

    await service.remove("job-1")

    const [update] = fake.calls("update")
    expect(update && stepArgs(update, "set")[0]).toEqual({
      deletedAt: expect.any(Date),
      enabled: false,
      nextRunAt: null,
    })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test.each([
    ["update", () => service.update(codeJob.id, { name: "x" })],
    ["setEnabled", () => service.setEnabled(codeJob.id, false)],
    ["remove", () => service.remove(codeJob.id)],
    ["runNow", () => service.runNow(codeJob.id)],
  ])("%s rejects a code-declared job without writing", async (_, run) => {
    fake.queue("query.cronJob.findFirst", codeJob)

    await expect(run()).rejects.toThrow(CronReadOnlyError)
    expect(fake.calls("update")).toEqual([])
    expect(triggerRun).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  test("runNow hands a manual job to the scheduler", async () => {
    fake.queue("query.cronJob.findFirst", cronJobRow())

    expect(await service.runNow("job-1")).toEqual(
      cronRunRow({ jobId: "job-1" })
    )
    expect(triggerRun).toHaveBeenCalledWith("job-1")
  })
})
