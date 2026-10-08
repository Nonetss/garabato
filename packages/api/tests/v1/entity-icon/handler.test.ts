import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { entityIconRow, stepArgs } from "@nonete/db/testing"
import type { z } from "zod"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { expectErrorCode } from "#tests/fixtures/errors"
import { deleteEntityIcons, entityIconHandler } from "#v1/entity-icon/handler"
import type { entityIconInput } from "#v1/entity-icon/input"
import { entityIconTargets } from "#v1/entity-icon/targets"

const TYPE = "test-entity"
const context = userContext()

// A test-only target, registered the same way an icon-capable feature does.
const readable = mock(
  async ({ entityIds }: { entityIds: string[] }) =>
    new Set(entityIds.filter((id) => id !== "hidden"))
)
const writable = mock(
  async ({ entityIds }: { entityIds: string[] }) =>
    new Set(entityIds.filter((id) => id === "mine"))
)

beforeEach(() => {
  fakeDb.reset()
  readable.mockClear()
  writable.mockClear()
  entityIconTargets[TYPE] = { readable, writable }
})

afterEach(() => {
  delete entityIconTargets[TYPE]
})

describe("entityIcon.getMany", () => {
  test("rejects an entity type without a target with BAD_REQUEST", async () => {
    await expectErrorCode(
      entityIconHandler.getMany({
        context,
        input: { entities: [{ entityType: "unknown", entityId: "a" }] },
      }),
      "BAD_REQUEST"
    )
  })

  test("returns the icons of readable entities only", async () => {
    fakeDb.queue("select", [entityIconRow({ entityType: TYPE, entityId: "a" })])

    const icons = await entityIconHandler.getMany({
      context,
      input: {
        entities: [
          { entityType: TYPE, entityId: "a" },
          { entityType: TYPE, entityId: "a" },
          { entityType: TYPE, entityId: "hidden" },
        ],
      },
    })

    expect(readable).toHaveBeenCalledWith({
      context,
      entityIds: ["a", "hidden"],
    })
    expect(icons).toEqual([
      { entityType: TYPE, entityId: "a", icon: "book-open", color: "orange" },
    ])
  })

  test("makes no query when nothing is readable", async () => {
    const icons = await entityIconHandler.getMany({
      context,
      input: { entities: [{ entityType: TYPE, entityId: "hidden" }] },
    })

    expect(icons).toEqual([])
    expect(fakeDb.calls()).toEqual([])
  })
})

describe("entityIcon.set", () => {
  test("rejects an entity the caller can't restyle with NOT_FOUND", async () => {
    await expectErrorCode(
      entityIconHandler.set({
        context,
        input: {
          entityType: TYPE,
          entityId: "theirs",
          icon: "star",
          color: "orange",
        },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls()).toEqual([])
  })

  test("upserts the icon as the caller", async () => {
    fakeDb.queue("insert", [
      entityIconRow({ entityType: TYPE, entityId: "mine", icon: "star" }),
    ])

    const icon = await entityIconHandler.set({
      context,
      input: {
        entityType: TYPE,
        entityId: "mine",
        icon: "star",
        color: "orange",
      },
    })

    const [insert] = fakeDb.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toMatchObject({
      entityId: "mine",
      icon: "star",
      createdBy: "user-id",
    })
    expect(insert?.steps.map((step) => step.method)).toContain(
      "onConflictDoUpdate"
    )
    expect(icon).toEqual({
      entityType: TYPE,
      entityId: "mine",
      icon: "star",
      color: "orange",
    })
  })
})

describe("entityIcon.clear", () => {
  test("rejects an entity the caller can't restyle with NOT_FOUND", async () => {
    await expectErrorCode(
      entityIconHandler.clear({
        context,
        input: { entityType: TYPE, entityId: "theirs" },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls()).toEqual([])
  })

  test("deletes the icon of a writable entity", async () => {
    fakeDb.queue("delete", [])

    expect(
      await entityIconHandler.clear({
        context,
        input: { entityType: TYPE, entityId: "mine" },
      })
    ).toEqual({ success: true })
    expect(fakeDb.calls("delete")).toHaveLength(1)
  })
})

describe("deleteEntityIcons", () => {
  test("makes no query without ids", async () => {
    await deleteEntityIcons({ entityType: TYPE, entityIds: [] })
    expect(fakeDb.calls()).toEqual([])
  })
})

describe("documentFolder icon target", () => {
  const FOLDER_ID = "00000000-0000-4000-8000-00000000a001"
  const input: z.infer<typeof entityIconInput.set> = {
    entityType: "documentFolder",
    entityId: FOLDER_ID,
    icon: "briefcase",
    color: "blue",
  }

  test("lets the owner set a folder's icon", async () => {
    fakeDb.queue("select", [{ id: FOLDER_ID }])
    fakeDb.queue("insert", [
      entityIconRow({
        entityType: "documentFolder",
        entityId: FOLDER_ID,
        icon: "briefcase",
        color: "blue",
      }),
    ])

    const icon = await entityIconHandler.set({ context, input })

    expect(icon).toEqual({
      entityType: "documentFolder",
      entityId: FOLDER_ID,
      icon: "briefcase",
      color: "blue",
    })
  })

  test("answers NOT_FOUND for another user's folder", async () => {
    fakeDb.queue("select", [])

    await expectErrorCode(
      entityIconHandler.set({ context, input }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("never queries for ids that can't be folders", async () => {
    await expectErrorCode(
      entityIconHandler.clear({
        context,
        input: { entityType: "documentFolder", entityId: "not-a-uuid" },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls()).toEqual([])
  })
})
