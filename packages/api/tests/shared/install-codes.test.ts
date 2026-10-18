import { describe, expect, test } from "bun:test"
import {
  createInstallCodes,
  formatInstallCode,
  INSTALL_CODE_TTL_MS,
  normalizeInstallCode,
} from "#shared/install-codes"

function setup() {
  const clock = { now: Date.parse("2026-01-01T10:00:00.000Z") }
  const codes = createInstallCodes(() => clock.now)
  return { clock, codes }
}

describe("start", () => {
  test("gives 8 characters without look-alikes, expiring in 10 minutes", () => {
    const { clock, codes } = setup()

    const pending = codes.start("user-1", "Firefox portátil")

    expect(pending.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
    expect(pending.expiresAt).toBe(clock.now + INSTALL_CODE_TTL_MS)
    expect(pending.name).toBe("Firefox portátil")
  })

  test("never repeats a live code", () => {
    const { codes } = setup()
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(codes.start("user-1", "x").code)

    expect(seen.size).toBe(200)
  })
})

describe("formatInstallCode", () => {
  test("splits the code in two halves", () => {
    expect(formatInstallCode("7KQ4XMPA")).toBe("7KQ4-XMPA")
  })
})

describe("normalizeInstallCode", () => {
  test("accepts lower case, a dash and spaces", () => {
    expect(normalizeInstallCode(" 7kq4-xmpa ")).toBe("7KQ4XMPA")
  })

  test("rejects other lengths and characters", () => {
    expect(normalizeInstallCode("7KQ4XMP")).toBeNull()
    expect(normalizeInstallCode("7KQ4XMPI")).toBeNull()
    expect(normalizeInstallCode("7KQ4XMP!")).toBeNull()
  })
})

describe("redeem", () => {
  test("spends a code once", () => {
    const { codes } = setup()
    const { code } = codes.start("user-1", "Firefox")

    expect(codes.redeem(code)?.userId).toBe("user-1")
    expect(codes.redeem(code)).toBeNull()
    expect(codes.peek(code)).toBeNull()
  })

  test("accepts the code as the dialog shows it", () => {
    const { codes } = setup()
    const { code } = codes.start("user-1", "Firefox")

    expect(
      codes.redeem(`${code.slice(0, 4)}-${code.slice(4).toLowerCase()}`)
    ).not.toBeNull()
  })

  test("refuses an expired code", () => {
    const { clock, codes } = setup()
    const { code } = codes.start("user-1", "Firefox")

    clock.now += INSTALL_CODE_TTL_MS
    expect(codes.peek(code)).toBeNull()
    expect(codes.redeem(code)).toBeNull()
  })

  test("a released code can be redeemed again", () => {
    const { codes } = setup()
    const { code } = codes.start("user-1", "Firefox")
    codes.redeem(code)

    codes.release(code)

    expect(codes.redeem(code)).not.toBeNull()
  })
})

describe("state", () => {
  test("goes from pending to connected with the key", () => {
    const { clock, codes } = setup()
    const { code } = codes.start("user-1", "Firefox")

    expect(codes.state("user-1", code)).toEqual({
      state: "pending",
      expiresAt: new Date(clock.now + INSTALL_CODE_TTL_MS),
    })
    codes.redeem(code)
    codes.complete(code, "key-1")

    expect(codes.state("user-1", code)).toEqual({
      state: "connected",
      keyId: "key-1",
    })
  })

  test("is pending while the key is being created", () => {
    const { codes } = setup()
    const { code } = codes.start("user-1", "Firefox")

    codes.redeem(code)

    expect(codes.state("user-1", code)?.state).toBe("pending")
  })

  test("reports an unused code as expired after its 10 minutes", () => {
    const { clock, codes } = setup()
    const { code } = codes.start("user-1", "Firefox")

    clock.now += INSTALL_CODE_TTL_MS

    expect(codes.state("user-1", code)).toEqual({ state: "expired" })
  })

  test("forgets a code one more period after it expired", () => {
    const { clock, codes } = setup()
    const { code } = codes.start("user-1", "Firefox")

    clock.now += 2 * INSTALL_CODE_TTL_MS
    codes.start("user-2", "other")

    expect(codes.state("user-1", code)).toBeNull()
  })

  test("is null for another user's connection", () => {
    const { codes } = setup()
    const { code } = codes.start("user-1", "Firefox")

    expect(codes.state("user-2", code)).toBeNull()
  })
})
