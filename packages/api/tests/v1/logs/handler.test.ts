import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test"
import { env } from "@nonete/env/server"

const LOKI_URL = "http://loki.test:3100"

// The preload leaves LOKI_URL unset; this copy lets each test choose. Module
// mocks last for the whole run, so every other var keeps its real value.
const testEnv = { ...env }
mock.module("@nonete/env/server", () => ({ env: testEnv }))

const { logsHandler } = await import("#v1/logs/handler")
const { expectErrorCode } = await import("#tests/fixtures/errors")

type QueryInput = Parameters<typeof logsHandler.query>[0]["input"]

const fetchSpy = spyOn(globalThis, "fetch")

function input(overrides: Partial<QueryInput> = {}): QueryInput {
  return { limit: 50, ...overrides }
}

function lokiResponse(values: [string, string][]) {
  return Response.json({ data: { result: [{ stream: {}, values }] } })
}

/** Nanosecond Loki timestamp for an ISO date. */
function ns(iso: string) {
  return `${BigInt(new Date(iso).getTime()) * 1_000_000n}`
}

function requestedUrl(): URL {
  const [url] = fetchSpy.mock.calls[0] ?? []
  if (!(url instanceof URL)) throw new Error("fetch was not called with a URL")
  return url
}

beforeEach(() => {
  testEnv.LOKI_URL = LOKI_URL
  fetchSpy.mockReset()
})

afterEach(() => {
  testEnv.LOKI_URL = undefined
})

describe("logs.query", () => {
  test("returns nothing without calling Loki when LOKI_URL is unset", async () => {
    testEnv.LOKI_URL = undefined

    expect(await logsHandler.query({ input: input() })).toEqual({
      entries: [],
      nextCursor: null,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test("adds each filter to the LogQL query, escaped", async () => {
    fetchSpy.mockResolvedValue(lokiResponse([]))

    await logsHandler.query({
      input: input({
        type: "api_call",
        userId: 'u"1\\x',
        method: "POST",
        path: "/api/v1/a.b",
      }),
    })

    const query = requestedUrl().searchParams.get("query")
    expect(query).toContain('| type="api_call"')
    expect(query).toContain('| userId="u\\"1\\\\x"')
    expect(query).toContain('| method="POST"')
    expect(query).toContain('| path=~".*/api/v1/a\\.b.*"')
    expect(requestedUrl().searchParams.get("limit")).toBe("51")
  })

  test("fails with BAD_GATEWAY when Loki can't be reached", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"))
    await expectErrorCode(logsHandler.query({ input: input() }), "BAD_GATEWAY")
  })

  test("fails with BAD_GATEWAY when Loki answers with an error", async () => {
    fetchSpy.mockResolvedValue(new Response("boom", { status: 500 }))
    await expectErrorCode(logsHandler.query({ input: input() }), "BAD_GATEWAY")
  })

  test("parses lines newest first, skipping unparsable ones", async () => {
    fetchSpy.mockResolvedValue(
      lokiResponse([
        [
          ns("2026-01-01T10:00:00.000Z"),
          JSON.stringify({
            level: 30,
            type: "page_view",
            msg: "old",
            path: "/",
          }),
        ],
        [ns("2026-01-01T11:00:00.000Z"), "not json"],
        [
          ns("2026-01-01T12:00:00.000Z"),
          JSON.stringify({
            level: 50,
            type: "api_call",
            msg: "new",
            method: "GET",
            status: 500,
          }),
        ],
      ])
    )

    const { entries, nextCursor } = await logsHandler.query({ input: input() })

    expect(entries.map((entry) => [entry.message, entry.level])).toEqual([
      ["new", "error"],
      ["old", "info"],
    ])
    expect(entries[0]).toMatchObject({
      timestamp: "2026-01-01T12:00:00.000Z",
      method: "GET",
      statusCode: 500,
      path: null,
    })
    expect(nextCursor).toBeNull()
  })

  test("returns a cursor when there are more entries than the limit", async () => {
    fetchSpy.mockResolvedValue(
      lokiResponse([
        [ns("2026-01-01T12:00:00.000Z"), JSON.stringify({ msg: "a" })],
        [ns("2026-01-01T11:00:00.000Z"), JSON.stringify({ msg: "b" })],
      ])
    )

    const { entries, nextCursor } = await logsHandler.query({
      input: input({ limit: 1 }),
    })

    expect(entries).toHaveLength(1)
    expect(nextCursor).toBe("2026-01-01T12:00:00.000Z")
  })
})
