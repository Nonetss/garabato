import { describe, expect, test } from "bun:test"
import { userDisplayName } from "@/lib/user-display"

describe("userDisplayName", () => {
  test("uses the trimmed name", () => {
    expect(userDisplayName({ name: "  Ana  ", email: "ana@example.com" })).toBe(
      "Ana"
    )
  })

  test("falls back to the email local part", () => {
    expect(
      userDisplayName({ name: "  ", email: "ana.lopez@example.com" })
    ).toBe("ana.lopez")
  })

  test("falls back to a generic label", () => {
    expect(userDisplayName({ name: null, email: null })).toBe("Usuario")
    expect(userDisplayName({ email: "@example.com" })).toBe("Usuario")
  })
})
