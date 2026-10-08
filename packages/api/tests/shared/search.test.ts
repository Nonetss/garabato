import { describe, expect, test } from "bun:test"

import { likePattern, searchLimit, searchQuery } from "#shared/search"

describe("likePattern", () => {
  test("wraps a plain term for a contains match", () => {
    expect(likePattern("ana")).toBe("%ana%")
  })

  test("escapes ILIKE wildcards and the escape character", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%")
  })
})

describe("searchQuery", () => {
  test("trims the term", () => {
    expect(searchQuery().parse("  ana  ")).toBe("ana")
  })

  test("enforces the minimum length after trimming", () => {
    expect(searchQuery().safeParse(" a ").success).toBe(false)
    expect(searchQuery(1).safeParse(" a ").success).toBe(true)
  })
})

describe("searchLimit", () => {
  test("defaults and caps the suggestion count", () => {
    const limit = searchLimit()
    expect(limit.parse(undefined)).toBe(5)
    expect(limit.parse(20)).toBe(20)
    expect(limit.safeParse(21).success).toBe(false)
    expect(limit.safeParse(0).success).toBe(false)
  })
})
