import { describe, expect, test } from "bun:test"
import type { Context } from "#context"
import { clientIp } from "#shared/client-ip"

function contextWith(headers: Record<string, string>): Context {
  return { user: null, session: null, headers: new Headers(headers) }
}

describe("clientIp", () => {
  test("returns the first X-Forwarded-For entry", () => {
    expect(
      clientIp(contextWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))
    ).toBe("203.0.113.7")
  })

  test("returns null without the header", () => {
    expect(clientIp(contextWith({}))).toBeNull()
  })

  test("returns null for an empty first entry", () => {
    expect(clientIp(contextWith({ "x-forwarded-for": " , 10.0.0.1" }))).toBe(
      null
    )
  })
})
