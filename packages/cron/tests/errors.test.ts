import { describe, expect, test } from "bun:test"

import { isUniqueViolation } from "#errors"

describe("isUniqueViolation", () => {
  test("detects code 23505 on the error itself", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true)
  })

  test("detects code 23505 on the error's cause", () => {
    const error = new Error("insert failed", { cause: { code: "23505" } })
    expect(isUniqueViolation(error)).toBe(true)
  })

  test("is false for other errors and non-objects", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false)
    expect(isUniqueViolation(new Error("boom"))).toBe(false)
    expect(isUniqueViolation("23505")).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})
