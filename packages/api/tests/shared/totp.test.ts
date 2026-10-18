import { describe, expect, test } from "bun:test"
import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
} from "@nonete/auth/two-factor"
import { matchTotpStep, totpAt } from "#shared/totp"

// RFC 6238 appendix B, SHA-1 secret, truncated to 6 digits.
const RFC_SECRET = "12345678901234567890"
const STEP = 30 * 1000

describe("matchTotpStep", () => {
  test("matches the RFC 6238 test vectors", () => {
    expect(matchTotpStep(RFC_SECRET, "287082", 59 * 1000)).toBe(1)
    expect(matchTotpStep(RFC_SECRET, "081804", 1111111109 * 1000)).toBe(
      37037036
    )
    expect(matchTotpStep(RFC_SECRET, "005924", 1234567890 * 1000)).toBe(
      41152263
    )
  })

  test("accepts the previous and next step, not further", () => {
    const now = 1_000_000 * STEP
    const previous = totpAt(RFC_SECRET, now - STEP)
    const next = totpAt(RFC_SECRET, now + STEP)
    const tooOld = totpAt(RFC_SECRET, now - 2 * STEP)

    expect(matchTotpStep(RFC_SECRET, previous, now)).toBe(999_999)
    expect(matchTotpStep(RFC_SECRET, next, now)).toBe(1_000_001)
    expect(matchTotpStep(RFC_SECRET, tooOld, now)).toBeNull()
  })

  test("rejects a wrong or malformed code", () => {
    expect(matchTotpStep(RFC_SECRET, "000000", 59 * 1000)).toBeNull()
    expect(matchTotpStep(RFC_SECRET, "28708", 59 * 1000)).toBeNull()
    expect(matchTotpStep(RFC_SECRET, "", 59 * 1000)).toBeNull()
  })
})

describe("two-factor secret", () => {
  test("decrypts what the plugin encrypts", async () => {
    const encrypted = await encryptTwoFactorSecret("plugin-secret")

    expect(encrypted).not.toContain("plugin-secret")
    expect(await decryptTwoFactorSecret(encrypted)).toBe("plugin-secret")
  })
})
