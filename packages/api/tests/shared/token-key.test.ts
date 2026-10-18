import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { auth } from "@nonete/auth"
import { sessionHeaders, verifyTokenKey } from "#shared/token-key"
import { refusedTokenKey, verifiedTokenKey } from "#tests/fixtures/token"

const verifyApiKey = spyOn(auth.api, "verifyApiKey")

afterEach(() => verifyApiKey.mockReset())

describe("verifyTokenKey", () => {
  test("returns a key carrying the token permission", async () => {
    verifyApiKey.mockResolvedValue(verifiedTokenKey())

    expect((await verifyTokenKey("sk_token"))?.id).toBe("key-1")
    expect(verifyApiKey).toHaveBeenCalledWith({ body: { key: "sk_token" } })
  })

  test("refuses an ordinary API key", async () => {
    verifyApiKey.mockResolvedValue(
      verifiedTokenKey({ permissions: { other: ["use"] } })
    )

    expect(await verifyTokenKey("sk_plain")).toBeNull()
  })

  test("refuses an invalid key", async () => {
    verifyApiKey.mockResolvedValue(refusedTokenKey())

    expect(await verifyTokenKey("sk_gone")).toBeNull()
  })
})

describe("sessionHeaders", () => {
  test("drops a token key so it never becomes a session", async () => {
    verifyApiKey.mockResolvedValue(verifiedTokenKey())
    const headers = new Headers({ "x-api-key": "sk_token", cookie: "a=b" })

    const result = await sessionHeaders(headers)

    expect(result.get("x-api-key")).toBeNull()
    expect(result.get("cookie")).toBe("a=b")
  })

  test("keeps an ordinary API key", async () => {
    verifyApiKey.mockResolvedValue(verifiedTokenKey({ permissions: null }))
    const headers = new Headers({ "x-api-key": "sk_plain" })

    expect((await sessionHeaders(headers)).get("x-api-key")).toBe("sk_plain")
  })

  test("leaves a request without a key untouched", async () => {
    const headers = new Headers({ cookie: "a=b" })

    expect(await sessionHeaders(headers)).toBe(headers)
    expect(verifyApiKey).not.toHaveBeenCalled()
  })
})
