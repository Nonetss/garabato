import { describe, expect, test } from "bun:test"
import {
  defaultMergeName,
  mergeRequest,
} from "@/features/documents/overview/model/merge"
import { moveItem } from "@/features/documents/shared/model/reorder"

describe("moveItem", () => {
  test("moves an item forward and backward", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"])
  })

  test("clamps positions and keeps the list when nothing moves", () => {
    const items = ["a", "b"]
    expect(moveItem(items, 0, 9)).toEqual(["b", "a"])
    expect(moveItem(items, 1, 1)).toBe(items)
    expect(moveItem(items, 0, -3)).toBe(items)
    expect(moveItem([], 0, 1)).toEqual([])
  })

  test("does not change the original list", () => {
    const items = ["a", "b"]
    moveItem(items, 0, 1)
    expect(items).toEqual(["a", "b"])
  })
})

describe("defaultMergeName", () => {
  test("is the first document's name without .pdf", () => {
    expect(
      defaultMergeName([{ name: "Contrato.PDF" }, { name: "anexo.pdf" }])
    ).toBe("Contrato")
    expect(defaultMergeName([{ name: "acta" }])).toBe("acta")
    expect(defaultMergeName([])).toBe("")
  })
})

describe("mergeRequest", () => {
  test("sends the ids in order and the folder only when there is one", () => {
    const order = [{ id: "b" }, { id: "a" }]
    expect(mergeRequest(order, "unido", null)).toEqual({
      documentIds: ["b", "a"],
      name: "unido",
    })
    expect(mergeRequest(order, "unido", "folder-1")).toEqual({
      documentIds: ["b", "a"],
      name: "unido",
      folderId: "folder-1",
    })
  })
})
