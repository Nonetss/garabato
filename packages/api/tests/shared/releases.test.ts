import { describe, expect, mock, test } from "bun:test"
import {
  createReleaseFeed,
  type LatestRelease,
  newerRelease,
  parseLatestRelease,
} from "#shared/releases"

const release: LatestRelease = {
  version: "0.4.0",
  url: "https://github.com/Nonetss/garabato/releases/tag/v0.4.0",
  publishedAt: "2026-10-20T10:00:00Z",
}

const HOUR = 60 * 60 * 1000

describe("parseLatestRelease", () => {
  test("reads the version from the tag, without the v", () => {
    expect(
      parseLatestRelease({
        tag_name: "v0.4.0",
        html_url: release.url,
        published_at: release.publishedAt,
        name: "ignored",
      })
    ).toEqual(release)
  })

  test("rejects a body without a version tag or the fields it needs", () => {
    expect(parseLatestRelease(null)).toBeNull()
    expect(parseLatestRelease("v0.4.0")).toBeNull()
    expect(
      parseLatestRelease({ tag_name: "v0.4.0", html_url: release.url })
    ).toBeNull()
    expect(
      parseLatestRelease({
        tag_name: "nightly",
        html_url: release.url,
        published_at: release.publishedAt,
      })
    ).toBeNull()
  })
})

describe("newerRelease", () => {
  test("answers a release newer than the running version", () => {
    expect(newerRelease("0.3.1", release)).toEqual(release)
    expect(newerRelease("0.3.10", { ...release, version: "0.10.0" })).toEqual({
      ...release,
      version: "0.10.0",
    })
  })

  test("answers null for the same, an older or no release", () => {
    expect(newerRelease("0.4.0", release)).toBeNull()
    expect(newerRelease("1.0.0", release)).toBeNull()
    expect(newerRelease("0.3.1", null)).toBeNull()
  })
})

describe("createReleaseFeed", () => {
  function feedAt(load: () => Promise<LatestRelease | null>) {
    const clock = { now: 0 }
    const feed = createReleaseFeed({ load, now: () => clock.now })
    return { feed, clock }
  }

  test("looks the release up once per six hours", async () => {
    const load = mock(async () => release)
    const { feed, clock } = feedAt(load)
    const onFailure = mock()

    expect(await feed.latest(onFailure)).toEqual(release)
    clock.now = 6 * HOUR - 1
    expect(await feed.latest(onFailure)).toEqual(release)
    expect(load).toHaveBeenCalledTimes(1)

    clock.now = 6 * HOUR
    await feed.latest(onFailure)
    expect(load).toHaveBeenCalledTimes(2)
    expect(onFailure).not.toHaveBeenCalled()
  })

  test("shares one lookup between concurrent callers", async () => {
    const load = mock(async () => release)
    const { feed } = feedAt(load)

    const answers = await Promise.all([
      feed.latest(mock()),
      feed.latest(mock()),
    ])

    expect(answers).toEqual([release, release])
    expect(load).toHaveBeenCalledTimes(1)
  })

  test("answers null on a failure, reports it and retries after 30 minutes", async () => {
    const failure = new Error("offline")
    const load = mock(async (): Promise<LatestRelease | null> => {
      throw failure
    })
    const { feed, clock } = feedAt(load)
    const onFailure = mock()

    expect(await feed.latest(onFailure)).toBeNull()
    expect(onFailure).toHaveBeenCalledWith(failure)
    clock.now = HOUR / 2 - 1
    expect(await feed.latest(onFailure)).toBeNull()
    expect(load).toHaveBeenCalledTimes(1)

    load.mockImplementation(async () => release)
    clock.now = HOUR / 2
    expect(await feed.latest(onFailure)).toEqual(release)
  })
})
