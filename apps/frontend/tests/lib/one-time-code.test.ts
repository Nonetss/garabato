import { describe, expect, test } from "bun:test"
import { TOTP_CODE_LENGTH, totpCodeDigits } from "@/lib/one-time-code"

describe("totpCodeDigits", () => {
  test("keeps a plain six-digit code", () => {
    expect(totpCodeDigits("123456")).toBe("123456")
  })

  test("drops the spaces and dashes apps and copies add", () => {
    expect(totpCodeDigits("123 456")).toBe("123456")
    expect(totpCodeDigits(" 12-34-56 ")).toBe("123456")
  })

  test("drops letters", () => {
    expect(totpCodeDigits("12a3b4")).toBe("1234")
  })

  test("never returns more than the code length", () => {
    expect(totpCodeDigits("1234567890")).toHaveLength(TOTP_CODE_LENGTH)
  })

  test("returns an empty string for no digits", () => {
    expect(totpCodeDigits("abc")).toBe("")
  })
})
