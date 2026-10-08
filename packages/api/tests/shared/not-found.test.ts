import { describe, expect, test } from "bun:test"
import { ORPCError } from "@orpc/server"

import { assertFound } from "#shared/not-found"

function thrownBy(run: () => unknown) {
  try {
    run()
  } catch (error) {
    return error as ORPCError<string, unknown>
  }
  throw new Error("Expected the call to throw")
}

describe("assertFound", () => {
  test("returns the row when present", () => {
    const row = { id: "row-id" }
    expect(assertFound(row)).toBe(row)
  })

  test("throws NOT_FOUND with the default message", () => {
    for (const missing of [null, undefined]) {
      const error = thrownBy(() => assertFound(missing))
      expect(error).toBeInstanceOf(ORPCError)
      expect(error.code).toBe("NOT_FOUND")
      expect(error.message).toBe("Not Found")
    }
  })

  test("throws NOT_FOUND with a custom message", () => {
    const error = thrownBy(() => assertFound(null, "Colección no encontrada"))
    expect(error.code).toBe("NOT_FOUND")
    expect(error.message).toBe("Colección no encontrada")
  })
})
