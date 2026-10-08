import { describe, expect, test } from "bun:test"
import { cleanLabel, sameLabel } from "#shared/labels"

describe("cleanLabel", () => {
  test("strips control characters and trims", () => {
    expect(cleanLabel("  Contra\u0000tos\u001f ")).toBe("Contratos")
    expect(cleanLabel("\u0007")).toBe("")
  })
})

describe("sameLabel", () => {
  test("ignores case", () => {
    expect(sameLabel("Urgente", "URGENTE")).toBe(true)
    expect(sameLabel("Urgente", "Urgentes")).toBe(false)
  })
})
