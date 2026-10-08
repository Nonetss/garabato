import { describe, expect, test } from "bun:test"
import { requireUserId } from "#shared/caller"
import { anonymousContext, userContext } from "#tests/fixtures/context"

describe("requireUserId", () => {
  test("returns the signed-in user's id", () => {
    expect(requireUserId(userContext())).toBe("user-id")
  })

  test("rejects an anonymous caller with UNAUTHORIZED", () => {
    expect(() => requireUserId(anonymousContext())).toThrow()
  })
})
