import { describe, expect, test } from "bun:test"
import { ORPCError } from "@orpc/server"

import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  paginate,
  paginateWithTotal,
  paginationCursor,
  paginationLimit,
} from "#shared/pagination"

function expectBadRequest(run: () => unknown) {
  let error: unknown
  try {
    run()
  } catch (thrown) {
    error = thrown
  }
  expect(error).toBeInstanceOf(ORPCError)
  expect((error as ORPCError<string, unknown>).code).toBe("BAD_REQUEST")
}

describe("paginate", () => {
  test("returns every row without more when below the limit", () => {
    expect(paginate([1, 2], 3)).toEqual({
      page: [1, 2],
      hasMore: false,
      lastRow: 2,
    })
  })

  test("returns every row without more when exactly at the limit", () => {
    expect(paginate([1, 2, 3], 3)).toEqual({
      page: [1, 2, 3],
      hasMore: false,
      lastRow: 3,
    })
  })

  test("drops the over-fetched row and reports more", () => {
    expect(paginate([1, 2, 3, 4], 3)).toEqual({
      page: [1, 2, 3],
      hasMore: true,
      lastRow: 3,
    })
  })

  test("has no last row for an empty page", () => {
    expect(paginate([], 3)).toEqual({
      page: [],
      hasMore: false,
      lastRow: undefined,
    })
  })
})

describe("paginateWithTotal", () => {
  test("adds the grand total to the page", async () => {
    const result = await paginateWithTotal(
      Promise.resolve([1, 2, 3]),
      Promise.resolve([{ total: 10 }]),
      2
    )
    expect(result).toEqual({
      page: [1, 2],
      hasMore: true,
      lastRow: 2,
      total: 10,
    })
  })

  test("reports a total of 0 when the count query returns no row", async () => {
    const result = await paginateWithTotal(
      Promise.resolve([]),
      Promise.resolve([]),
      2
    )
    expect(result.total).toBe(0)
  })
})

describe("keyset cursor", () => {
  const timestamp = new Date("2026-03-04T05:06:07.890Z")

  test("round-trips a timestamp and an id", () => {
    const cursor = encodeKeysetCursor(timestamp, "row-id")
    expect(decodeKeysetCursor(cursor)).toEqual({ timestamp, id: "row-id" })
  })

  test("keeps separators inside the id", () => {
    const cursor = encodeKeysetCursor(timestamp, "a|b")
    expect(decodeKeysetCursor(cursor)?.id).toBe("a|b")
  })

  test("returns undefined for a missing cursor", () => {
    expect(decodeKeysetCursor(null)).toBeUndefined()
    expect(decodeKeysetCursor(undefined)).toBeUndefined()
    expect(decodeKeysetCursor("")).toBeUndefined()
  })

  test("rejects a cursor without separator", () => {
    expectBadRequest(() => decodeKeysetCursor("2026-03-04T05:06:07.890Z"))
  })

  test("rejects a cursor with an invalid timestamp", () => {
    expectBadRequest(() => decodeKeysetCursor("not-a-date|row-id"))
  })

  test("rejects a cursor with an empty id", () => {
    expectBadRequest(() => decodeKeysetCursor(`${timestamp.toISOString()}|`))
  })
})

describe("paginationLimit", () => {
  const limit = paginationLimit(20, 100)

  test("defaults when omitted", () => {
    expect(limit.parse(undefined)).toBe(20)
  })

  test("accepts values within bounds", () => {
    expect(limit.parse(1)).toBe(1)
    expect(limit.parse(100)).toBe(100)
  })

  test("rejects values out of bounds or fractional", () => {
    expect(limit.safeParse(0).success).toBe(false)
    expect(limit.safeParse(101).success).toBe(false)
    expect(limit.safeParse(1.5).success).toBe(false)
  })
})

describe("paginationCursor", () => {
  test("accepts a string, null or nothing", () => {
    const cursor = paginationCursor()
    expect(cursor.parse("abc")).toBe("abc")
    expect(cursor.parse(null)).toBeNull()
    expect(cursor.parse(undefined)).toBeUndefined()
  })
})
