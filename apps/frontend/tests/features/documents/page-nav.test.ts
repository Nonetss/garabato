import { describe, expect, test } from "bun:test"
import {
  clampPageIndex,
  currentPageIndex,
} from "@/features/documents/detail/model/page-nav"

describe("currentPageIndex", () => {
  test("is the first page before any scrolling", () => {
    expect(currentPageIndex([24, 900, 1800], 300, false)).toBe(0)
  })

  test("is the last page whose top passed the probe", () => {
    expect(currentPageIndex([-1200, -300, 250, 1100], 300, false)).toBe(2)
  })

  test("stays on the first page when every top is below the probe", () => {
    expect(currentPageIndex([400, 1300], 300, false)).toBe(0)
  })

  test("is the last page once the pane is scrolled to the end", () => {
    expect(currentPageIndex([-1800, -900, 500], 300, true)).toBe(2)
  })

  test("is 0 for an empty document", () => {
    expect(currentPageIndex([], 300, true)).toBe(0)
  })
})

describe("clampPageIndex", () => {
  test("keeps an index inside the range", () => {
    expect(clampPageIndex(2, 5)).toBe(2)
  })

  test("clamps below the first and past the last page", () => {
    expect(clampPageIndex(-1, 5)).toBe(0)
    expect(clampPageIndex(9, 5)).toBe(4)
  })

  test("is 0 when there are no pages", () => {
    expect(clampPageIndex(3, 0)).toBe(0)
  })
})
