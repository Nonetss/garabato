import { beforeEach, describe, expect, test } from "bun:test"
import {
  type CommentRow,
  commentRow,
  stepArgs,
  userRow,
} from "@nonete/db/testing"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { expectErrorCode } from "#tests/fixtures/errors"
import { commentHandler } from "#v1/comment/handler"

const ENTITY = {
  entityType: "organization",
  entityId: "00000000-0000-4000-8000-000000000001",
}
const OTHER_ENTITY_ID = "00000000-0000-4000-8000-000000000002"

const context = userContext()
const me = userRow({ id: "user-id", name: "Me" })
const someoneElse = userRow({ id: "other-id", name: "Other" })

function withAuthor(row: CommentRow, author = me) {
  return { ...row, author }
}

beforeEach(() => fakeDb.reset())

describe("comment.list", () => {
  test("nests replies and drops deleted roots that have no replies", async () => {
    const deletedRoot = commentRow({
      id: "root-deleted",
      content: "removed",
      deletedAt: new Date("2026-01-02T00:00:00.000Z"),
    })
    const reply = commentRow({ id: "reply", parentId: "root-deleted" })
    const deletedLeaf = commentRow({
      id: "root-gone",
      deletedAt: new Date("2026-01-02T00:00:00.000Z"),
    })
    const visible = commentRow({ id: "root-visible" })
    fakeDb.queue("query.comments.findMany", [
      withAuthor(deletedRoot),
      withAuthor(reply),
      withAuthor(deletedLeaf),
      withAuthor(visible),
    ])

    const tree = await commentHandler.list({ input: ENTITY })

    expect(tree.map((node) => node.id)).toEqual([
      "root-deleted",
      "root-visible",
    ])
    expect(tree[0]?.content).toBe("")
    expect(tree[0]?.deletedAt).toBe("2026-01-02T00:00:00.000Z")
    expect(tree[0]?.replies.map((node) => node.id)).toEqual(["reply"])
  })
})

describe("comment.counts", () => {
  test("returns 0 for entities without comments", async () => {
    fakeDb.queue("select", [{ ...ENTITY, count: 3 }])

    const counts = await commentHandler.counts({
      input: {
        entities: [ENTITY, { ...ENTITY, entityId: OTHER_ENTITY_ID }],
      },
    })

    expect(counts.map((entry) => entry.count)).toEqual([3, 0])
  })
})

describe("comment.create", () => {
  const reply = { ...ENTITY, content: "Reply", parentId: "parent" }

  test("rejects a missing parent with NOT_FOUND", async () => {
    fakeDb.queue("query.comments.findFirst", undefined)
    await expectErrorCode(
      commentHandler.create({ context, input: reply }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("rejects a deleted parent with NOT_FOUND", async () => {
    fakeDb.queue(
      "query.comments.findFirst",
      commentRow({ id: "parent", deletedAt: new Date() })
    )
    await expectErrorCode(
      commentHandler.create({ context, input: reply }),
      "NOT_FOUND"
    )
  })

  test("rejects a parent on another entity with BAD_REQUEST", async () => {
    fakeDb.queue(
      "query.comments.findFirst",
      commentRow({ id: "parent", entityId: OTHER_ENTITY_ID })
    )
    await expectErrorCode(
      commentHandler.create({ context, input: reply }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("stores the comment as the caller and returns it", async () => {
    fakeDb.queue("insert", [{ id: "new" }])
    fakeDb.queue(
      "query.comments.findFirst",
      withAuthor(commentRow({ id: "new", content: "Hello" }))
    )

    const node = await commentHandler.create({
      context,
      input: { ...ENTITY, content: "Hello" },
    })

    const [insert] = fakeDb.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toEqual({
      content: "Hello",
      ...ENTITY,
      parentId: null,
      authorId: "user-id",
    })
    expect(node).toMatchObject({ id: "new", content: "Hello", replies: [] })
  })
})

describe("comment.update", () => {
  test("rejects a non-author with FORBIDDEN", async () => {
    fakeDb.queue(
      "query.comments.findFirst",
      withAuthor(commentRow(), someoneElse)
    )
    await expectErrorCode(
      commentHandler.update({
        context,
        input: { id: "comment-1", content: "Edited" },
      }),
      "FORBIDDEN"
    )
    expect(fakeDb.calls("update")).toEqual([])
  })

  test("rejects a deleted comment with NOT_FOUND", async () => {
    fakeDb.queue(
      "query.comments.findFirst",
      withAuthor(commentRow({ deletedAt: new Date() }))
    )
    await expectErrorCode(
      commentHandler.update({
        context,
        input: { id: "comment-1", content: "Edited" },
      }),
      "NOT_FOUND"
    )
  })
})

describe("comment.delete", () => {
  test("rejects a non-author with FORBIDDEN", async () => {
    fakeDb.queue(
      "query.comments.findFirst",
      withAuthor(commentRow(), someoneElse)
    )
    await expectErrorCode(
      commentHandler.delete({ context, input: { id: "comment-1" } }),
      "FORBIDDEN"
    )
    expect(fakeDb.calls("update")).toEqual([])
  })

  test("succeeds without writing when already deleted", async () => {
    fakeDb.queue(
      "query.comments.findFirst",
      withAuthor(commentRow({ deletedAt: new Date() }), someoneElse)
    )

    expect(
      await commentHandler.delete({ context, input: { id: "comment-1" } })
    ).toEqual({ id: "comment-1", success: true })
    expect(fakeDb.calls("update")).toEqual([])
  })

  test("soft-deletes the author's comment", async () => {
    fakeDb.queue("query.comments.findFirst", withAuthor(commentRow()))
    fakeDb.queue("update", [])

    await commentHandler.delete({ context, input: { id: "comment-1" } })

    const [update] = fakeDb.calls("update")
    expect(update && stepArgs(update, "set")[0]).toEqual({
      deletedAt: expect.any(Date),
    })
  })
})
