import { beforeEach, describe, expect, test } from "bun:test"
import {
  RECENT_SURFACES_LIMIT,
  readRecentSurfaces,
  recordRecentSurface,
} from "@/lib/recent-surfaces"

beforeEach(() => {
  localStorage.clear()
})

describe("recent surfaces", () => {
  test("records newest first and moves a repeated href to the front", () => {
    recordRecentSurface("u1", "/a")
    recordRecentSurface("u1", "/b")
    expect(recordRecentSurface("u1", "/a")).toEqual(["/a", "/b"])
    expect(readRecentSurfaces("u1")).toEqual(["/a", "/b"])
  })

  test("is bounded by the limit", () => {
    for (let index = 0; index < RECENT_SURFACES_LIMIT + 3; index++) {
      recordRecentSurface("u1", `/page-${index}`)
    }
    expect(readRecentSurfaces("u1")).toHaveLength(RECENT_SURFACES_LIMIT)
  })

  test("is scoped per user", () => {
    recordRecentSurface("u1", "/a")
    expect(readRecentSurfaces("u2")).toEqual([])
  })

  test("degrades to an empty list on malformed storage", () => {
    localStorage.setItem("recent-surfaces:u1", "{not json")
    expect(readRecentSurfaces("u1")).toEqual([])
    localStorage.setItem("recent-surfaces:u1", JSON.stringify({ a: 1 }))
    expect(readRecentSurfaces("u1")).toEqual([])
  })
})
