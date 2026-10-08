import { beforeEach, describe, expect, test } from "bun:test"
import { sessionRow, userRow } from "@nonete/db/testing"

import { decodeKeysetCursor } from "#shared/pagination"
import { adminContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { sessionHistoryHandler } from "#v1/session-history/handler"

const context = adminContext()

function sessionWithUser(id: string, createdAt: string) {
  return {
    ...sessionRow({ id, createdAt: new Date(createdAt) }),
    user: userRow(),
  }
}

beforeEach(() => fakeDb.reset())

describe("sessionHistory.list", () => {
  test("returns one page and a cursor to its last row when more exist", async () => {
    fakeDb.queue("query.session.findMany", [
      sessionWithUser("s3", "2026-01-03T00:00:00.000Z"),
      sessionWithUser("s2", "2026-01-02T00:00:00.000Z"),
      sessionWithUser("s1", "2026-01-01T00:00:00.000Z"),
    ])
    fakeDb.queue("select", [{ total: 3 }])

    const result = await sessionHistoryHandler.list({
      context,
      input: { limit: 2 },
    })

    expect(result.sessions.map((session) => session.id)).toEqual(["s3", "s2"])
    expect(result.total).toBe(3)
    expect(decodeKeysetCursor(result.nextCursor ?? undefined)).toEqual({
      timestamp: new Date("2026-01-02T00:00:00.000Z"),
      id: "s2",
    })
  })

  test("has no cursor on the last page", async () => {
    fakeDb.queue("query.session.findMany", [
      sessionWithUser("s1", "2026-01-01T00:00:00.000Z"),
    ])
    fakeDb.queue("select", [{ total: 1 }])

    const result = await sessionHistoryHandler.list({
      context,
      input: { limit: 2 },
    })

    expect(result.nextCursor).toBeNull()
  })

  test("skips sessions whose user is gone", async () => {
    fakeDb.queue("query.session.findMany", [
      { ...sessionRow({ id: "orphan" }), user: null },
      sessionWithUser("s1", "2026-01-01T00:00:00.000Z"),
    ])
    fakeDb.queue("select", [{ total: 2 }])

    const result = await sessionHistoryHandler.list({
      context,
      input: { limit: 25 },
    })

    expect(result.sessions.map((session) => session.id)).toEqual(["s1"])
  })
})
