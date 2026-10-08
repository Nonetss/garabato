import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { auth } from "@nonete/auth"
import { listedApiKey, listedApiKeys } from "#tests/fixtures/auth"
import { userContext } from "#tests/fixtures/context"
import { apiKeyHandler } from "#v1/api-key/handler"

const listApiKeys = spyOn(auth.api, "listApiKeys")
const createApiKey = spyOn(auth.api, "createApiKey")

afterEach(() => {
  listApiKeys.mockReset()
  createApiKey.mockReset()
})

describe("apiKey.list", () => {
  test("serializes dates as ISO strings or null", async () => {
    listApiKeys.mockResolvedValue(
      listedApiKeys([
        listedApiKey({ expiresAt: new Date("2026-02-01T00:00:00.000Z") }),
        listedApiKey({ id: "key-2" }),
      ])
    )

    const items = await apiKeyHandler.list({ context: userContext() })

    expect(items[0]).toEqual({
      id: "key-1",
      name: "CI deploy",
      start: "sk_ab",
      prefix: "sk_",
      enabled: true,
      expiresAt: "2026-02-01T00:00:00.000Z",
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    })
    expect(items[1]?.expiresAt).toBeNull()
  })
})

describe("apiKey.create", () => {
  test("serializes every date field Better Auth returns", async () => {
    const lastRequest = new Date("2026-01-05T08:00:00.000Z")
    createApiKey.mockResolvedValue({
      ...listedApiKey({ lastRequest }),
      key: "sk_secret",
    })

    const created = await apiKeyHandler.create({
      context: userContext(),
      input: { name: "CI deploy", expiresIn: 3600 },
    })

    expect(createApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { configId: "default", name: "CI deploy", expiresIn: 3600 },
      })
    )
    expect(created).toMatchObject({
      key: "sk_secret",
      lastRefillAt: null,
      lastRequest: "2026-01-05T08:00:00.000Z",
      expiresAt: null,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    })
  })
})

describe("apiKey.search", () => {
  test("matches names case-insensitively, up to the limit", async () => {
    listApiKeys.mockResolvedValue(
      listedApiKeys([
        listedApiKey({ id: "a", name: "Deploy prod" }),
        listedApiKey({ id: "b", name: "Backup" }),
        listedApiKey({ id: "c", name: "deploy staging" }),
        listedApiKey({ id: "d", name: null }),
      ])
    )

    const found = await apiKeyHandler.search({
      context: userContext(),
      input: { query: "DEPLOY", limit: 1 },
    })

    expect(found).toEqual([{ id: "a", name: "Deploy prod", prefix: "sk_" }])
  })
})
