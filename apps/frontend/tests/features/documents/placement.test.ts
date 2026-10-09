import { describe, expect, test } from "bun:test"
import {
  isTap,
  isUsableRect,
  rectBetween,
  stampAt,
  TAP_STAMP_RATIO,
  TAP_STAMP_WIDTH,
} from "@/features/documents/detail/model/placement"

// A4 portrait: height over width.
const A4 = 297 / 210

describe("stampAt", () => {
  test("centers a standard stamp on the tapped point", () => {
    const stamp = stampAt({ x: 0.5, y: 0.5 }, A4)
    expect(stamp.width).toBe(TAP_STAMP_WIDTH)
    expect(stamp.x + stamp.width / 2).toBeCloseTo(0.5)
    expect(stamp.y + stamp.height / 2).toBeCloseTo(0.5)
  })

  test("keeps paper proportions on any page shape", () => {
    for (const aspect of [A4, 1 / A4, 1]) {
      const stamp = stampAt({ x: 0.5, y: 0.5 }, aspect)
      // Back to paper units: width over (height × aspect).
      expect(stamp.width / (stamp.height * aspect)).toBeCloseTo(TAP_STAMP_RATIO)
    }
  })

  test("stays inside the page near its edges", () => {
    for (const point of [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.98, y: 0.02 },
    ]) {
      const stamp = stampAt(point, A4)
      expect(stamp.x).toBeGreaterThanOrEqual(0)
      expect(stamp.y).toBeGreaterThanOrEqual(0)
      expect(stamp.x + stamp.width).toBeLessThanOrEqual(1)
      expect(stamp.y + stamp.height).toBeLessThanOrEqual(1)
    }
  })

  test("is big enough to sign", () => {
    expect(isUsableRect(stampAt({ x: 0.5, y: 0.9 }, A4))).toBe(true)
  })
})

describe("isTap", () => {
  test("accepts a touch that barely moved", () => {
    expect(isTap({ x: 0.4, y: 0.4 }, { x: 0.41, y: 0.395 })).toBe(true)
  })

  test("rejects a touch that travelled like a scroll", () => {
    expect(isTap({ x: 0.4, y: 0.4 }, { x: 0.4, y: 0.5 })).toBe(false)
  })
})

describe("rectBetween", () => {
  test("spans a drag in any direction", () => {
    const rect = rectBetween({ x: 0.6, y: 0.5 }, { x: 0.2, y: 0.3 })
    expect(rect.x).toBe(0.2)
    expect(rect.y).toBe(0.3)
    expect(rect.width).toBeCloseTo(0.4)
    expect(rect.height).toBeCloseTo(0.2)
  })
})
