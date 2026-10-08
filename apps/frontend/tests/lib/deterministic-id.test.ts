import { describe, expect, test } from "bun:test"
import { deterministicUuid } from "@/lib/deterministic-id"

const UUID_V4_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/

describe("deterministicUuid", () => {
  test("is stable for the same seed", () => {
    expect(deterministicUuid("admin")).toBe(deterministicUuid("admin"))
  })

  test("differs between seeds", () => {
    expect(deterministicUuid("admin")).not.toBe(deterministicUuid("apiKey"))
  })

  test("is shaped like a v4 UUID", () => {
    expect(deterministicUuid("admin")).toMatch(UUID_V4_SHAPE)
    expect(deterministicUuid("")).toMatch(UUID_V4_SHAPE)
  })
})
