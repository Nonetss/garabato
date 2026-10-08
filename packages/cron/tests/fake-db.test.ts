import { beforeEach, describe, expect, test } from "bun:test"
import { cronJob, cronRun } from "@nonete/db/schema/cron"
import { createFakeDb, cronJobRow, stepArgs } from "@nonete/db/testing"
import { eq } from "drizzle-orm"

const fake = createFakeDb()

beforeEach(() => fake.reset())

describe("fake db", () => {
  test("resolves queued results in order, per operation", async () => {
    const first = cronJobRow({ id: "a" })
    const second = cronJobRow({ id: "b" })
    fake.queue("query.cronJob.findFirst", first, second)
    fake.queue("select", [])

    expect(
      await fake.db.query.cronJob.findFirst({ where: { id: "a" } })
    ).toEqual(first)
    expect(await fake.db.select().from(cronRun)).toEqual([])
    expect(
      await fake.db.query.cronJob.findFirst({ where: { id: "b" } })
    ).toEqual(second)
  })

  test("records every awaited chain with its steps", async () => {
    fake.queue("update", [])
    await fake.db
      .update(cronJob)
      .set({ enabled: false })
      .where(eq(cronJob.id, "a"))

    const [call] = fake.calls("update")
    expect(call?.steps.map((step) => step.method)).toEqual([
      "update",
      "set",
      "where",
    ])
    if (call) expect(stepArgs(call, "set")).toEqual([{ enabled: false }])
    expect(fake.calls("insert")).toEqual([])
  })

  test("rejects a chain with nothing queued, naming the operation", async () => {
    await expect(
      Promise.resolve(fake.db.query.cronRun.findMany())
    ).rejects.toThrow('no result queued for "query.cronRun.findMany"')
  })
})
