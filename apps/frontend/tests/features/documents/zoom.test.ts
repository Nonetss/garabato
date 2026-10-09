import { describe, expect, test } from "bun:test"
import {
  anchorShift,
  FIT_ZOOM,
  pageAnchor,
  ZOOM_STEPS,
  zoomIn,
  zoomOut,
  zoomPercent,
} from "@/features/documents/detail/model/zoom"

describe("zoomIn", () => {
  test("steps up from the fitted width", () => {
    expect(zoomIn(FIT_ZOOM)).toBe(1.25)
  })

  test("stays at the top of the scale", () => {
    expect(zoomIn(3)).toBe(3)
  })

  test("snaps an off-scale value to the next step", () => {
    expect(zoomIn(1.1)).toBe(1.25)
  })
})

describe("zoomOut", () => {
  test("steps down from the fitted width", () => {
    expect(zoomOut(FIT_ZOOM)).toBe(0.75)
  })

  test("stays at the bottom of the scale", () => {
    expect(zoomOut(0.5)).toBe(0.5)
  })

  test("snaps an off-scale value to the previous step", () => {
    expect(zoomOut(1.1)).toBe(1)
  })

  test("walks the whole scale back down", () => {
    const visited: number[] = []
    for (let zoom = 3; !visited.includes(zoom); zoom = zoomOut(zoom)) {
      visited.push(zoom)
    }
    expect(visited).toEqual([...ZOOM_STEPS].reverse())
  })
})

describe("zoomPercent", () => {
  test("rounds to a whole percentage", () => {
    expect(zoomPercent(1)).toBe("100 %")
    expect(zoomPercent(0.75)).toBe("75 %")
    expect(zoomPercent(1.25)).toBe("125 %")
  })
})

describe("pageAnchor", () => {
  const pages = [
    { top: -900, height: 800 },
    { top: -76, height: 800 },
    { top: 748, height: 800 },
  ]

  test("is null without pages", () => {
    expect(pageAnchor([], 300)).toBeNull()
  })

  test("holds the page under the line and how far down it falls", () => {
    expect(pageAnchor(pages, 324)).toEqual({ page: 1, fraction: 0.5 })
  })

  test("falls back to the first page above every top", () => {
    expect(pageAnchor([{ top: 24, height: 800 }], 0)).toEqual({
      page: 0,
      fraction: 0,
    })
  })

  test("clamps a line in the gap below a page to its bottom", () => {
    expect(pageAnchor([{ top: 0, height: 100 }], 110)).toEqual({
      page: 0,
      fraction: 1,
    })
  })

  test("is the page top while the page has no height yet", () => {
    expect(pageAnchor([{ top: 0, height: 0 }], 50)).toEqual({
      page: 0,
      fraction: 0,
    })
  })
})

describe("anchorShift", () => {
  test("scrolls the anchored point back under the line", () => {
    // Page 1 doubled in size: its middle moved from 324 to 1500.
    expect(anchorShift({ top: 700, height: 1600 }, 0.5, 324)).toBe(1176)
  })

  test("is zero when the point never moved", () => {
    expect(anchorShift({ top: -76, height: 800 }, 0.5, 324)).toBe(0)
  })
})
