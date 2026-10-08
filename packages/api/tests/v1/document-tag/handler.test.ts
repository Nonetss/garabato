import { beforeEach, describe, expect, test } from "bun:test"
import { documentTagRow, stepArgs } from "@nonete/db/testing"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { expectErrorCode } from "#tests/fixtures/errors"
import { documentTagHandler } from "#v1/document-tag/handler"

const USER_ID = "user-id"
const TAG_ID = "00000000-0000-4000-8000-0000000000b1"
const context = userContext()

function written(op: "insert" | "update") {
  const [call] = fakeDb.calls(op)
  if (!call) throw new Error(`no ${op} call`)
  const [values] = stepArgs(call, op === "insert" ? "values" : "set")
  return values
}

beforeEach(() => fakeDb.reset())

describe("documentTag.list", () => {
  test("maps tags with their live document counts", async () => {
    fakeDb.queue("select", [
      { tag: documentTagRow({ name: "Clientes" }), documentCount: 3 },
      { tag: documentTagRow({ name: "Urgente" }), documentCount: null },
    ])

    const list = await documentTagHandler.list({ context })

    expect(list.map((tag) => [tag.name, tag.documentCount])).toEqual([
      ["Clientes", 3],
      ["Urgente", 0],
    ])
  })
})

describe("documentTag.create", () => {
  test("creates a neutral tag by default", async () => {
    fakeDb.queue("insert", [documentTagRow({ name: "Urgente" })])

    const tag = await documentTagHandler.create({
      context,
      input: { name: " Urgente\u0000" },
    })

    expect(written("insert")).toEqual({
      userId: USER_ID,
      name: "Urgente",
      color: "neutral",
    })
    expect(tag).toMatchObject({ name: "Urgente", color: "neutral" })
  })

  test("keeps the chosen color", async () => {
    fakeDb.queue("insert", [documentTagRow({ color: "rose" })])

    await documentTagHandler.create({
      context,
      input: { name: "Urgente", color: "rose" },
    })

    expect(written("insert")).toMatchObject({ color: "rose" })
  })

  test("answers CONFLICT for a name the caller already uses", async () => {
    fakeDb.queueError("insert", { cause: { code: "23505" } })

    await expectErrorCode(
      documentTagHandler.create({ context, input: { name: "urgente" } }),
      "CONFLICT"
    )
  })

  test("rejects a name made only of control characters", async () => {
    await expectErrorCode(
      documentTagHandler.create({ context, input: { name: "\u0001" } }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls()).toEqual([])
  })
})

describe("documentTag.update", () => {
  test("recolors without touching the name", async () => {
    fakeDb.queue("update", [documentTagRow({ color: "blue" })])

    const tag = await documentTagHandler.update({
      context,
      input: { id: TAG_ID, color: "blue" },
    })

    expect(written("update")).toEqual({ color: "blue" })
    expect(tag.color).toBe("blue")
  })

  test("renames without touching the color", async () => {
    fakeDb.queue("update", [documentTagRow({ name: "Prioritario" })])

    await documentTagHandler.update({
      context,
      input: { id: TAG_ID, name: "Prioritario" },
    })

    expect(written("update")).toEqual({ name: "Prioritario" })
  })

  test("answers CONFLICT when renaming to another tag's name", async () => {
    fakeDb.queueError("update", { code: "23505" })

    await expectErrorCode(
      documentTagHandler.update({
        context,
        input: { id: TAG_ID, name: "Clientes" },
      }),
      "CONFLICT"
    )
  })

  test("answers NOT_FOUND for another user's tag", async () => {
    fakeDb.queue("update", [])

    await expectErrorCode(
      documentTagHandler.update({
        context,
        input: { id: TAG_ID, color: "blue" },
      }),
      "NOT_FOUND"
    )
  })
})

describe("documentTag.delete", () => {
  test("deletes an owned tag", async () => {
    fakeDb.queue("delete", [{ id: TAG_ID }])

    const result = await documentTagHandler.delete({
      context,
      input: { id: TAG_ID },
    })

    expect(result).toEqual({ id: TAG_ID, success: true })
  })

  test("answers NOT_FOUND for another user's tag", async () => {
    fakeDb.queue("delete", [])

    await expectErrorCode(
      documentTagHandler.delete({ context, input: { id: TAG_ID } }),
      "NOT_FOUND"
    )
  })
})
