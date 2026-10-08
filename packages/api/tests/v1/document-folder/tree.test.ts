import { describe, expect, test } from "bun:test"
import {
  childrenOf,
  depthOf,
  type FolderNode,
  freeName,
  isSelfOrDescendant,
  subtreeHeight,
} from "#v1/document-folder/tree"

// clientes/contratos/2024, clientes/antiguos, facturas
const folders: FolderNode[] = [
  { id: "clientes", parentId: null, name: "Clientes" },
  { id: "contratos", parentId: "clientes", name: "Contratos" },
  { id: "2024", parentId: "contratos", name: "2024" },
  { id: "antiguos", parentId: "clientes", name: "Antiguos" },
  { id: "facturas", parentId: null, name: "Facturas" },
]

describe("depthOf", () => {
  test("counts top-level folders as level 1 and the root as 0", () => {
    expect(depthOf(folders, null)).toBe(0)
    expect(depthOf(folders, "clientes")).toBe(1)
    expect(depthOf(folders, "2024")).toBe(3)
  })

  test("stops on a cycle instead of looping", () => {
    const looped: FolderNode[] = [
      { id: "a", parentId: "b", name: "A" },
      { id: "b", parentId: "a", name: "B" },
    ]
    expect(depthOf(looped, "a")).toBe(2)
  })
})

describe("subtreeHeight", () => {
  test("is 1 for a leaf and grows with the deepest branch", () => {
    expect(subtreeHeight(folders, "2024")).toBe(1)
    expect(subtreeHeight(folders, "clientes")).toBe(3)
  })
})

describe("isSelfOrDescendant", () => {
  test("detects the folder itself and anything below it", () => {
    expect(isSelfOrDescendant(folders, "clientes", "clientes")).toBe(true)
    expect(isSelfOrDescendant(folders, "2024", "clientes")).toBe(true)
    expect(isSelfOrDescendant(folders, "facturas", "clientes")).toBe(false)
    expect(isSelfOrDescendant(folders, "clientes", "2024")).toBe(false)
  })
})

describe("childrenOf", () => {
  test("lists direct children, or top-level folders for the root", () => {
    expect(childrenOf(folders, "clientes").map((f) => f.id)).toEqual([
      "contratos",
      "antiguos",
    ])
    expect(childrenOf(folders, null).map((f) => f.id)).toEqual([
      "clientes",
      "facturas",
    ])
  })
})

describe("freeName", () => {
  test("keeps a free name", () => {
    expect(freeName(["Facturas"], "2024")).toBe("2024")
  })

  test("appends the first free number, ignoring case", () => {
    expect(freeName(["2024"], "2024")).toBe("2024 (2)")
    expect(freeName(["Antiguos", "antiguos (2)"], "ANTIGUOS")).toBe(
      "ANTIGUOS (3)"
    )
  })
})
