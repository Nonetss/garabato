import { afterAll, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { APP_VERSION } from "#shared/releases"
import { adminContext, userContext } from "#tests/fixtures/context"
import { releaseHandler } from "#v1/release/handler"

const fetchSpy = spyOn(globalThis, "fetch")

// Other files may have called fetch since the spy was installed.
beforeEach(() => fetchSpy.mockClear())
afterAll(() => fetchSpy.mockRestore())

describe("release.status", () => {
  test("answers only the running version to a non-admin, without GitHub", async () => {
    const status = await releaseHandler.status({ context: userContext() })

    expect(status).toEqual({ current: APP_VERSION, update: null })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test("answers an administrator the newer GitHub release", async () => {
    fetchSpy.mockResolvedValue(
      Response.json({
        tag_name: "v999.0.0",
        html_url: "https://github.com/Nonetss/garabato/releases/tag/v999.0.0",
        published_at: "2026-10-20T10:00:00Z",
      })
    )

    const status = await releaseHandler.status({ context: adminContext() })

    expect(status).toEqual({
      current: APP_VERSION,
      update: {
        version: "999.0.0",
        url: "https://github.com/Nonetss/garabato/releases/tag/v999.0.0",
        publishedAt: "2026-10-20T10:00:00Z",
      },
    })
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.github.com/repos/Nonetss/garabato/releases/latest"
    )
  })
})
