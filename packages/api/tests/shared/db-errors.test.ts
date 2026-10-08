import { describe, expect, test } from "bun:test"
import { isUniqueViolation } from "#shared/db-errors"

describe("isUniqueViolation", () => {
  test("matches a raw or wrapped unique_violation", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true)
    expect(isUniqueViolation({ cause: { cause: { code: "23505" } } })).toBe(
      true
    )
  })

  test("ignores other errors", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false)
    expect(isUniqueViolation(new Error("boom"))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})
