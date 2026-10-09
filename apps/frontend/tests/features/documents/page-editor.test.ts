import { describe, expect, test } from "bun:test"
import {
  canSave,
  type EditorPage,
  editRequestPages,
  initialPages,
  isDirty,
  type PageEditorAction,
  pageEditorReducer,
  pageEditorSummary,
} from "@/features/documents/detail/model/page-editor"

function apply(pages: EditorPage[], ...actions: PageEditorAction[]) {
  return actions.reduce(pageEditorReducer, pages)
}

describe("initialPages", () => {
  test("lists every page in order, unrotated and kept", () => {
    expect(initialPages(2)).toEqual([
      { source: 0, rotation: 0, removed: false },
      { source: 1, rotation: 0, removed: false },
    ])
  })
})

describe("pageEditorReducer", () => {
  test("moves a page to another position", () => {
    const pages = apply(initialPages(3), { type: "move", from: 2, to: 0 })
    expect(pages.map((page) => page.source)).toEqual([2, 0, 1])
  })

  test("moves before and after with neighbouring positions", () => {
    const before = apply(initialPages(3), { type: "move", from: 1, to: 0 })
    expect(before.map((page) => page.source)).toEqual([1, 0, 2])
    const after = apply(initialPages(3), { type: "move", from: 1, to: 2 })
    expect(after.map((page) => page.source)).toEqual([0, 2, 1])
  })

  test("ignores a move past either end", () => {
    const pages = initialPages(2)
    expect(apply(pages, { type: "move", from: 0, to: -1 })).toBe(pages)
    const last = apply(pages, { type: "move", from: 1, to: 5 })
    expect(last).toBe(pages)
  })

  test("rotates right and left in quarter turns, wrapping around", () => {
    const right = apply(initialPages(1), {
      type: "rotate",
      index: 0,
      direction: "right",
    })
    expect(right[0]?.rotation).toBe(90)
    const left = apply(initialPages(1), {
      type: "rotate",
      index: 0,
      direction: "left",
    })
    expect(left[0]?.rotation).toBe(270)
    const full = apply(
      initialPages(1),
      ...Array.from(
        { length: 4 },
        (): PageEditorAction => ({
          type: "rotate",
          index: 0,
          direction: "right",
        })
      )
    )
    expect(full[0]?.rotation).toBe(0)
  })

  test("removes and restores a page in place", () => {
    const removed = apply(initialPages(2), { type: "toggleRemove", index: 1 })
    expect(removed[1]).toEqual({ source: 1, rotation: 0, removed: true })
    const restored = apply(removed, { type: "toggleRemove", index: 1 })
    expect(restored[1]?.removed).toBe(false)
  })

  test("resets to the untouched pages", () => {
    const edited = apply(
      initialPages(2),
      { type: "move", from: 0, to: 1 },
      { type: "toggleRemove", index: 0 }
    )
    expect(apply(edited, { type: "reset", pageCount: 2 })).toEqual(
      initialPages(2)
    )
  })
})

describe("isDirty and canSave", () => {
  test("is clean until something changes", () => {
    expect(isDirty(initialPages(2))).toBe(false)
    expect(canSave(initialPages(2))).toBe(false)
  })

  test("is clean again when a page moves back", () => {
    const pages = apply(
      initialPages(3),
      { type: "move", from: 0, to: 2 },
      { type: "move", from: 2, to: 0 }
    )
    expect(isDirty(pages)).toBe(false)
  })

  test("cannot save with every page removed", () => {
    const pages = apply(initialPages(1), { type: "toggleRemove", index: 0 })
    expect(isDirty(pages)).toBe(true)
    expect(canSave(pages)).toBe(false)
  })
})

describe("pageEditorSummary and editRequestPages", () => {
  test("count and send the kept pages in their new order", () => {
    const pages = apply(
      initialPages(4),
      { type: "move", from: 3, to: 0 },
      { type: "rotate", index: 1, direction: "right" },
      { type: "toggleRemove", index: 2 }
    )

    expect(pageEditorSummary(pages)).toEqual({
      pageCount: 3,
      removed: 1,
      rotated: 1,
    })
    expect(editRequestPages(pages)).toEqual([
      { page: 3, rotation: 0 },
      { page: 0, rotation: 90 },
      { page: 2, rotation: 0 },
    ])
  })
})
