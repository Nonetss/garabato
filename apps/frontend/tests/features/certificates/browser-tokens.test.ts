import { describe, expect, test } from "bun:test"
import { remainingLabel } from "@/features/certificates/overview/model/browser-tokens"

const EXPIRES = "2026-01-01T10:10:00.000Z"

describe("remainingLabel", () => {
  test("shows minutes and zero-padded seconds", () => {
    expect(
      remainingLabel(EXPIRES, Date.parse("2026-01-01T10:00:00.000Z"))
    ).toBe("10:00")
    expect(
      remainingLabel(EXPIRES, Date.parse("2026-01-01T10:09:51.500Z"))
    ).toBe("0:09")
  })

  test("stops at zero once the code expired", () => {
    expect(
      remainingLabel(EXPIRES, Date.parse("2026-01-01T10:12:00.000Z"))
    ).toBe("0:00")
  })
})
