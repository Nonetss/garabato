import { describe, expect, test } from "bun:test"

import { toIso, toIsoOrNull } from "#shared/dates"

const date = new Date("2026-03-04T05:06:07.890Z")

describe("toIso", () => {
  test("formats a date as an ISO string", () => {
    expect(toIso(date)).toBe("2026-03-04T05:06:07.890Z")
  })
})

describe("toIsoOrNull", () => {
  test("formats a date as an ISO string", () => {
    expect(toIsoOrNull(date)).toBe("2026-03-04T05:06:07.890Z")
  })

  test("maps a missing date to null", () => {
    expect(toIsoOrNull(null)).toBeNull()
    expect(toIsoOrNull(undefined)).toBeNull()
  })
})
