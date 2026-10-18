import { describe, expect, test } from "bun:test"
import {
  createTokenWindows,
  SIGNING_WINDOW_MS,
  UNLOCK_LOCKOUT_MS,
} from "#shared/token-window"

function setup() {
  const clock = { now: Date.parse("2026-01-01T10:00:00.000Z") }
  const windows = createTokenWindows(() => clock.now)
  return { clock, windows }
}

const MINUTE = 60 * 1000

describe("signing windows", () => {
  test("opens for 15 minutes and closes on its own", () => {
    const { clock, windows } = setup()

    const expiresAt = windows.open("key-1")

    expect(expiresAt.getTime()).toBe(clock.now + SIGNING_WINDOW_MS)
    expect(windows.isOpen("key-1")).toBe(true)
    clock.now += SIGNING_WINDOW_MS
    expect(windows.isOpen("key-1")).toBe(false)
  })

  test("opening again extends the window from that moment", () => {
    const { clock, windows } = setup()
    windows.open("key-1")

    clock.now += 10 * MINUTE
    windows.open("key-1")
    clock.now += 10 * MINUTE

    expect(windows.isOpen("key-1")).toBe(true)
  })

  test("closing ends the window at once", () => {
    const { windows } = setup()
    windows.open("key-1")

    windows.close("key-1")

    expect(windows.isOpen("key-1")).toBe(false)
  })

  test("a key's window does not open another key", () => {
    const { windows } = setup()

    windows.open("key-1")

    expect(windows.isOpen("key-2")).toBe(false)
  })
})

describe("TOTP steps", () => {
  test("a step is spent once", () => {
    const { windows } = setup()

    expect(windows.spendStep("user-1", 100)).toBe(true)
    expect(windows.spendStep("user-1", 100)).toBe(false)
  })

  test("an earlier step is refused after a later one", () => {
    const { windows } = setup()
    windows.spendStep("user-1", 101)

    expect(windows.spendStep("user-1", 100)).toBe(false)
    expect(windows.spendStep("user-1", 102)).toBe(true)
  })

  test("steps are per user", () => {
    const { windows } = setup()
    windows.spendStep("user-1", 100)

    expect(windows.spendStep("user-2", 100)).toBe(true)
  })
})

describe("unlock lockout", () => {
  test("the fifth wrong code within 15 minutes locks for 15 minutes", () => {
    const { clock, windows } = setup()
    for (let i = 0; i < 4; i++) {
      windows.recordFailure("user-1")
      clock.now += MINUTE
    }
    expect(windows.lockedUntil("user-1")).toBeNull()

    windows.recordFailure("user-1")

    expect(windows.lockedUntil("user-1")?.getTime()).toBe(
      clock.now + UNLOCK_LOCKOUT_MS
    )
    clock.now += UNLOCK_LOCKOUT_MS
    expect(windows.lockedUntil("user-1")).toBeNull()
  })

  test("wrong codes older than 15 minutes do not count", () => {
    const { clock, windows } = setup()
    for (let i = 0; i < 4; i++) windows.recordFailure("user-1")

    clock.now += UNLOCK_LOCKOUT_MS + 1
    windows.recordFailure("user-1")

    expect(windows.lockedUntil("user-1")).toBeNull()
  })

  test("a right code clears the count", () => {
    const { windows } = setup()
    for (let i = 0; i < 4; i++) windows.recordFailure("user-1")

    windows.clearFailures("user-1")
    windows.recordFailure("user-1")

    expect(windows.lockedUntil("user-1")).toBeNull()
  })

  test("lockouts are per user", () => {
    const { windows } = setup()
    for (let i = 0; i < 5; i++) windows.recordFailure("user-1")

    expect(windows.lockedUntil("user-2")).toBeNull()
  })
})
