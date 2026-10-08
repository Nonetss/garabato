import { beforeEach, describe, expect, test } from "bun:test"
import {
  CronNotFoundError,
  CronReadOnlyError,
  CronValidationError,
} from "@nonete/cron"
import { cronJobRow, cronRunRow } from "@nonete/db/testing"

import { encodeKeysetCursor } from "#shared/pagination"
import { adminContext } from "#tests/fixtures/context"
import { cronService, resetCronService } from "#tests/fixtures/cron-service"
import { expectErrorCode } from "#tests/fixtures/errors"
import { cronHandler } from "#v1/cron/handler"

const JOB_ID = "00000000-0000-4000-8000-000000000001"

const createInput = {
  name: "Nightly cleanup",
  cronExpression: "0 3 * * *",
  handlerKey: "v1.maintenance.cleanup",
  enabled: true,
}

beforeEach(() => resetCronService())

describe("cron error mapping", () => {
  test.each([
    [new CronNotFoundError("missing"), "NOT_FOUND"],
    [new CronReadOnlyError("code job"), "CONFLICT"],
    [new CronValidationError("bad expression"), "BAD_REQUEST"],
  ])("maps %p to %s", async (error, code) => {
    cronService.update.mockRejectedValue(error)
    await expectErrorCode(
      cronHandler.update({ input: { id: JOB_ID, name: "Renamed" } }),
      code
    )
  })

  test("lets unknown errors through unchanged", async () => {
    const boom = new Error("boom")
    cronService.remove.mockRejectedValue(boom)
    expect(cronHandler.remove({ input: { id: JOB_ID } })).rejects.toBe(boom)
  })
})

describe("cron.create", () => {
  test("binds the job to the caller when userId is omitted", async () => {
    cronService.create.mockResolvedValue(cronJobRow())

    await cronHandler.create({ context: adminContext(), input: createInput })

    expect(cronService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-id", timezone: "UTC" })
    )
  })

  test("runs the job with no user when userId is null", async () => {
    cronService.create.mockResolvedValue(cronJobRow())

    await cronHandler.create({
      context: adminContext(),
      input: { ...createInput, userId: null },
    })

    expect(cronService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null })
    )
  })

  test("serializes the stored job", async () => {
    cronService.create.mockResolvedValue(
      cronJobRow({ nextRunAt: new Date("2026-01-02T03:00:00.000Z") })
    )

    const job = await cronHandler.create({
      context: adminContext(),
      input: createInput,
    })

    expect(job).toMatchObject({
      id: "job-1",
      nextRunAt: "2026-01-02T03:00:00.000Z",
      lastRunAt: null,
      payload: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })
  })
})

describe("cron.listRuns", () => {
  const runs = [
    cronRunRow({
      id: "run-3",
      startedAt: new Date("2026-01-03T00:00:00.000Z"),
    }),
    cronRunRow({
      id: "run-2",
      startedAt: new Date("2026-01-02T00:00:00.000Z"),
    }),
    cronRunRow({
      id: "run-1",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
    }),
  ]

  test("over-fetches by one and returns a cursor to the last row", async () => {
    cronService.listRuns.mockResolvedValue(runs)

    const page = await cronHandler.listRuns({
      input: { jobId: JOB_ID, limit: 2 },
    })

    expect(cronService.listRuns).toHaveBeenCalledWith({
      jobId: JOB_ID,
      status: undefined,
      limit: 3,
      cursor: undefined,
    })
    expect(page.runs.map((run) => run.id)).toEqual(["run-3", "run-2"])
    expect(page.nextCursor).toBe(
      encodeKeysetCursor(new Date("2026-01-02T00:00:00.000Z"), "run-2")
    )
  })

  test("passes the decoded cursor and ends without one on the last page", async () => {
    cronService.listRuns.mockResolvedValue(runs.slice(2))
    const cursor = encodeKeysetCursor(
      new Date("2026-01-02T00:00:00.000Z"),
      "run-2"
    )

    const page = await cronHandler.listRuns({
      input: { jobId: JOB_ID, limit: 2, cursor },
    })

    expect(cronService.listRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: {
          startedAt: new Date("2026-01-02T00:00:00.000Z"),
          id: "run-2",
        },
      })
    )
    expect(page.nextCursor).toBeNull()
  })
})
