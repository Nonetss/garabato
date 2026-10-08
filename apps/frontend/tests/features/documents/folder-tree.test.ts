import { describe, expect, test } from "bun:test"
import {
  buildFolderIndex,
  childrenOf,
  descendantIdsOf,
  type FolderNode,
  flattenTree,
  folderPathLabel,
  pathOf,
} from "@/features/documents/shared/model/folder-tree"

// clientes/{contratos/2024, antiguos}, facturas — listed out of order.
const folders: FolderNode[] = [
  { id: "facturas", parentId: null, name: "Facturas" },
  { id: "contratos", parentId: "clientes", name: "contratos" },
  { id: "2024", parentId: "contratos", name: "2024" },
  { id: "clientes", parentId: null, name: "Clientes" },
  { id: "antiguos", parentId: "clientes", name: "Antiguos" },
]
const index = buildFolderIndex(folders)

const ids = (list: FolderNode[]) => list.map((folder) => folder.id)

describe("childrenOf", () => {
  test("sorts siblings by name, ignoring case", () => {
    expect(ids(childrenOf(index, null))).toEqual(["clientes", "facturas"])
    expect(ids(childrenOf(index, "clientes"))).toEqual([
      "antiguos",
      "contratos",
    ])
    expect(childrenOf(index, "2024")).toEqual([])
  })
})

describe("pathOf", () => {
  test("goes from the top level down to the folder", () => {
    expect(ids(pathOf(index, "2024"))).toEqual([
      "clientes",
      "contratos",
      "2024",
    ])
  })

  test("is empty for the root and for unknown folders", () => {
    expect(pathOf(index, null)).toEqual([])
    expect(pathOf(index, "missing")).toEqual([])
  })

  test("stops on a loop", () => {
    const looped = buildFolderIndex([
      { id: "a", parentId: "b", name: "A" },
      { id: "b", parentId: "a", name: "B" },
    ])
    expect(ids(pathOf(looped, "a"))).toEqual(["b", "a"])
  })
})

describe("descendantIdsOf", () => {
  test("collects every folder below, not the folder itself", () => {
    expect([...descendantIdsOf(index, "clientes")].sort()).toEqual([
      "2024",
      "antiguos",
      "contratos",
    ])
    expect(descendantIdsOf(index, "facturas").size).toBe(0)
  })
})

describe("flattenTree", () => {
  test("lists parents before children with their depth", () => {
    expect(flattenTree(index).map((row) => [row.folder.id, row.depth])).toEqual(
      [
        ["clientes", 0],
        ["antiguos", 1],
        ["contratos", 1],
        ["2024", 2],
        ["facturas", 0],
      ]
    )
  })
})

describe("folderPathLabel", () => {
  test("joins the path with slashes", () => {
    expect(folderPathLabel(index, "2024")).toBe("Clientes / contratos / 2024")
    expect(folderPathLabel(index, null)).toBe("")
  })
})
