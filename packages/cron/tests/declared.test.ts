import { beforeEach, describe, expect, test } from "bun:test"
import { createFakeDb, cronJobRow, stepArgs } from "@nonete/db/testing"

import { type DeclaredCronJob, syncDeclaredJobs } from "#declared"
import { silentLogger } from "#tests/fixtures/logger"

const fake = createFakeDb()
const RUN_AS = "admin-id"

const declared: DeclaredCronJob = {
  key: "v1.reports.daily",
  cronExpression: "0 6 * * *",
  name: "Daily report",
  description: "Sends the daily report",
}

const persisted = cronJobRow({
  id: "job-code",
  source: "code",
  handlerKey: declared.key,
  cronExpression: declared.cronExpression,
  name: declared.name,
  description: declared.description,
  userId: RUN_AS,
  enabled: true,
})

function sync(schedules: DeclaredCronJob[]) {
  return syncDeclaredJobs({
    db: fake.db,
    declared: schedules,
    logger: silentLogger(),
    runAsUserId: RUN_AS,
  })
}

/** The `set(...)` payload of each recorded update. */
function updates() {
  return fake.calls("update").map((call) => stepArgs(call, "set")[0])
}

beforeEach(() => fake.reset())

describe("syncDeclaredJobs", () => {
  test("creates a declared job that isn't persisted yet", async () => {
    fake.queue("query.cronJob.findMany", [])
    fake.queue("insert", [{ id: "job-new" }])

    await sync([declared])

    const [insert] = fake.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toMatchObject({
      name: declared.name,
      description: declared.description,
      cronExpression: declared.cronExpression,
      handlerKey: declared.key,
      source: "code",
      enabled: true,
      userId: RUN_AS,
      nextRunAt: expect.any(Date),
    })
  })

  test("leaves an identical job untouched", async () => {
    fake.queue("query.cronJob.findMany", [persisted])

    await sync([declared])

    expect(fake.calls("insert")).toEqual([])
    expect(fake.calls("update")).toEqual([])
  })

  test("updates a job whose declaration changed", async () => {
    fake.queue("query.cronJob.findMany", [persisted])
    fake.queue("update", [])

    await sync([{ ...declared, cronExpression: "0 7 * * *" }])

    expect(updates()).toEqual([
      expect.objectContaining({ cronExpression: "0 7 * * *", enabled: true }),
    ])
  })

  test("re-enables a disabled job and rebinds its run-as user", async () => {
    fake.queue("query.cronJob.findMany", [
      { ...persisted, enabled: false, userId: null },
    ])
    fake.queue("update", [])

    await sync([declared])

    expect(updates()).toEqual([
      expect.objectContaining({ enabled: true, userId: RUN_AS }),
    ])
  })

  test("soft-deletes a code job no longer declared", async () => {
    fake.queue("query.cronJob.findMany", [persisted])
    fake.queue("update", [])

    await sync([])

    expect(updates()).toEqual([
      { deletedAt: expect.any(Date), enabled: false, nextRunAt: null },
    ])
  })

  test("disables an existing job whose declared expression is invalid", async () => {
    fake.queue("query.cronJob.findMany", [persisted])
    fake.queue("update", [])

    await sync([{ ...declared, cronExpression: "every day" }])

    expect(updates()).toEqual([{ enabled: false, nextRunAt: null }])
    expect(fake.calls("insert")).toEqual([])
  })

  test("keeps syncing after a unique-name violation", async () => {
    const other: DeclaredCronJob = { ...declared, key: "v1.reports.weekly" }
    fake.queue("query.cronJob.findMany", [])
    fake.queueError("insert", { code: "23505" })
    fake.queue("insert", [{ id: "job-weekly" }])

    await sync([declared, other])

    expect(fake.calls("insert")).toHaveLength(2)
  })
})
