import { beforeEach, describe, expect, test } from "bun:test"
import {
  type DocumentFolderRow,
  documentFolderRow,
  stepArgs,
} from "@nonete/db/testing"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { expectErrorCode } from "#tests/fixtures/errors"
import { documentFolderHandler } from "#v1/document-folder/handler"

const USER_ID = "user-id"
const context = userContext()

const CLIENTES = "00000000-0000-4000-8000-00000000a001"
const CONTRATOS = "00000000-0000-4000-8000-00000000a002"
const ANTIGUOS = "00000000-0000-4000-8000-00000000a003"
const Y2024 = "00000000-0000-4000-8000-00000000a004"
const FACTURAS = "00000000-0000-4000-8000-00000000a005"
const FOREIGN = "00000000-0000-4000-8000-00000000a0ff"

function folder(id: string, name: string, parentId: string | null = null) {
  return documentFolderRow({ id, name, parentId, userId: USER_ID })
}

// clientes/{contratos, antiguos/2024}, facturas
const tree: DocumentFolderRow[] = [
  folder(CLIENTES, "Clientes"),
  folder(CONTRATOS, "Contratos", CLIENTES),
  folder(ANTIGUOS, "Antiguos", CLIENTES),
  folder(Y2024, "2024", ANTIGUOS),
  folder(FACTURAS, "Facturas"),
]

// The user-row lock and the folder load every tree write starts with.
function queueTree(folders: DocumentFolderRow[] = tree) {
  fakeDb.queue("select", [{ id: USER_ID }])
  fakeDb.queue("query.documentFolders.findMany", folders)
}

// A chain of `levels` nested folders, the deepest one last.
function chain(levels: number) {
  const folders: DocumentFolderRow[] = []
  for (let level = 1; level <= levels; level += 1) {
    const parentId = folders.at(-1)?.id ?? null
    folders.push(
      folder(
        `00000000-0000-4000-8000-${String(level).padStart(12, "0")}`,
        `Nivel ${level}`,
        parentId
      )
    )
  }
  return folders
}

function written(op: "insert" | "update", index = 0) {
  const call = fakeDb.calls(op)[index]
  if (!call) throw new Error(`no ${op} call #${index}`)
  const [values] = stepArgs(call, op === "insert" ? "values" : "set")
  return values
}

function expectNoWrites() {
  expect(fakeDb.calls("insert")).toEqual([])
  expect(fakeDb.calls("update")).toEqual([])
  expect(fakeDb.calls("delete")).toEqual([])
}

beforeEach(() => fakeDb.reset())

describe("documentFolder.list", () => {
  test("maps folders with their direct document counts", async () => {
    fakeDb.queue("select", [
      { folder: folder(CLIENTES, "Clientes"), documentCount: 1 },
      { folder: folder(CONTRATOS, "Contratos", CLIENTES), documentCount: null },
    ])

    const list = await documentFolderHandler.list({ context })

    expect(list).toEqual([
      expect.objectContaining({
        id: CLIENTES,
        parentId: null,
        documentCount: 1,
      }),
      expect.objectContaining({
        id: CONTRATOS,
        parentId: CLIENTES,
        documentCount: 0,
      }),
    ])
  })
})

describe("documentFolder.create", () => {
  test("creates a nested folder under one of the caller's folders", async () => {
    queueTree()
    fakeDb.queue("insert", [folder(FACTURAS, "Recibos", CLIENTES)])

    const result = await documentFolderHandler.create({
      context,
      input: { name: " Recibos\u0000 ", parentId: CLIENTES },
    })

    expect(written("insert")).toEqual({
      userId: USER_ID,
      parentId: CLIENTES,
      name: "Recibos",
    })
    expect(result).toMatchObject({ name: "Recibos", parentId: CLIENTES })
  })

  test("creates a top-level folder when no parent is given", async () => {
    queueTree()
    fakeDb.queue("insert", [folder(FACTURAS, "Nóminas")])

    await documentFolderHandler.create({ context, input: { name: "Nóminas" } })

    expect(written("insert")).toMatchObject({ parentId: null })
  })

  test("answers NOT_FOUND for a parent that isn't the caller's", async () => {
    queueTree()

    await expectErrorCode(
      documentFolderHandler.create({
        context,
        input: { name: "Recibos", parentId: FOREIGN },
      }),
      "NOT_FOUND"
    )
    expectNoWrites()
  })

  test("refuses a sibling name ignoring case with CONFLICT", async () => {
    queueTree()

    await expectErrorCode(
      documentFolderHandler.create({
        context,
        input: { name: "contratos", parentId: CLIENTES },
      }),
      "CONFLICT"
    )
    expectNoWrites()
  })

  test("treats top-level folders as siblings", async () => {
    queueTree()

    await expectErrorCode(
      documentFolderHandler.create({ context, input: { name: "FACTURAS" } }),
      "CONFLICT"
    )
  })

  test("refuses an eleventh level with CONFLICT", async () => {
    const folders = chain(10)
    queueTree(folders)

    await expectErrorCode(
      documentFolderHandler.create({
        context,
        input: { name: "Nivel 11", parentId: folders.at(-1)?.id },
      }),
      "CONFLICT"
    )
    expectNoWrites()
  })

  test("turns a unique violation from a race into CONFLICT", async () => {
    queueTree()
    fakeDb.queueError("insert", { code: "23505" })

    await expectErrorCode(
      documentFolderHandler.create({ context, input: { name: "Recibos" } }),
      "CONFLICT"
    )
  })

  test("rejects a name made only of control characters", async () => {
    await expectErrorCode(
      documentFolderHandler.create({ context, input: { name: "\u0007" } }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls()).toEqual([])
  })
})

describe("documentFolder.rename", () => {
  test("renames the folder", async () => {
    queueTree()
    fakeDb.queue("update", [folder(CONTRATOS, "Acuerdos", CLIENTES)])

    const result = await documentFolderHandler.rename({
      context,
      input: { id: CONTRATOS, name: "Acuerdos" },
    })

    expect(written("update")).toEqual({ name: "Acuerdos" })
    expect(result.name).toBe("Acuerdos")
  })

  test("lets a folder change the case of its own name", async () => {
    queueTree()
    fakeDb.queue("update", [folder(CONTRATOS, "CONTRATOS", CLIENTES)])

    await documentFolderHandler.rename({
      context,
      input: { id: CONTRATOS, name: "CONTRATOS" },
    })

    expect(written("update")).toEqual({ name: "CONTRATOS" })
  })

  test("refuses a sibling's name with CONFLICT", async () => {
    queueTree()

    await expectErrorCode(
      documentFolderHandler.rename({
        context,
        input: { id: CONTRATOS, name: "antiguos" },
      }),
      "CONFLICT"
    )
    expectNoWrites()
  })

  test("answers NOT_FOUND for another user's folder", async () => {
    queueTree()

    await expectErrorCode(
      documentFolderHandler.rename({
        context,
        input: { id: FOREIGN, name: "Mío" },
      }),
      "NOT_FOUND"
    )
    expectNoWrites()
  })
})

describe("documentFolder.move", () => {
  test("moves a folder to the library root", async () => {
    queueTree()
    fakeDb.queue("update", [folder(CONTRATOS, "Contratos")])

    const result = await documentFolderHandler.move({
      context,
      input: { id: CONTRATOS, parentId: null },
    })

    expect(written("update")).toEqual({ parentId: null })
    expect(result.parentId).toBeNull()
  })

  test("moves a folder under another one", async () => {
    queueTree()
    fakeDb.queue("update", [folder(ANTIGUOS, "Antiguos", FACTURAS)])

    await documentFolderHandler.move({
      context,
      input: { id: ANTIGUOS, parentId: FACTURAS },
    })

    expect(written("update")).toEqual({ parentId: FACTURAS })
  })

  test.each([
    ["itself", CLIENTES],
    ["a descendant", Y2024],
  ])("rejects a move into %s with BAD_REQUEST", async (_, parentId) => {
    queueTree()

    await expectErrorCode(
      documentFolderHandler.move({
        context,
        input: { id: CLIENTES, parentId },
      }),
      "BAD_REQUEST"
    )
    expectNoWrites()
  })

  test("answers NOT_FOUND for a destination that isn't the caller's", async () => {
    queueTree()

    await expectErrorCode(
      documentFolderHandler.move({
        context,
        input: { id: CONTRATOS, parentId: FOREIGN },
      }),
      "NOT_FOUND"
    )
    expectNoWrites()
  })

  test("refuses a destination holding the same name with CONFLICT", async () => {
    queueTree([...tree, folder(FOREIGN, "contratos", FACTURAS)])

    await expectErrorCode(
      documentFolderHandler.move({
        context,
        input: { id: CONTRATOS, parentId: FACTURAS },
      }),
      "CONFLICT"
    )
    expectNoWrites()
  })

  test("refuses a move that leaves descendants deeper than 10 levels", async () => {
    // A 9-level chain plus Clientes (3 levels with Antiguos/2024) under its
    // deepest folder would reach level 12.
    const folders = [...chain(9), ...tree]
    queueTree(folders)

    await expectErrorCode(
      documentFolderHandler.move({
        context,
        input: { id: CLIENTES, parentId: folders[8]?.id ?? null },
      }),
      "CONFLICT"
    )
    expectNoWrites()
  })

  test("writes nothing when the parent doesn't change", async () => {
    queueTree()

    const result = await documentFolderHandler.move({
      context,
      input: { id: CONTRATOS, parentId: CLIENTES },
    })

    expect(result.parentId).toBe(CLIENTES)
    expectNoWrites()
  })
})

describe("documentFolder.delete", () => {
  test("moves documents and subfolders up, then removes the icon and the folder", async () => {
    queueTree()
    fakeDb.queue("update", [], [])
    fakeDb.queue("delete", [], [])

    const result = await documentFolderHandler.delete({
      context,
      input: { id: ANTIGUOS },
    })

    expect(result).toEqual({ id: ANTIGUOS, success: true })
    expect(written("update", 0)).toEqual({ parentId: CLIENTES, name: "2024" })
    expect(written("update", 1)).toEqual({ folderId: CLIENTES })
    expect(fakeDb.calls("delete")).toHaveLength(2)
  })

  test("suffixes a subfolder whose name clashes in the parent", async () => {
    queueTree([...tree, folder(FOREIGN, "2024", CLIENTES)])
    fakeDb.queue("update", [], [])
    fakeDb.queue("delete", [], [])

    await documentFolderHandler.delete({ context, input: { id: ANTIGUOS } })

    expect(written("update", 0)).toEqual({
      parentId: CLIENTES,
      name: "2024 (2)",
    })
  })

  test("moves a top-level folder's contents to the library root", async () => {
    queueTree()
    fakeDb.queue("update", [], [], [])
    fakeDb.queue("delete", [], [])

    await documentFolderHandler.delete({ context, input: { id: CLIENTES } })

    expect(written("update", 0)).toEqual({ parentId: null, name: "Contratos" })
    expect(written("update", 1)).toEqual({ parentId: null, name: "Antiguos" })
    expect(written("update", 2)).toEqual({ folderId: null })
  })

  test("answers NOT_FOUND for another user's folder", async () => {
    queueTree()

    await expectErrorCode(
      documentFolderHandler.delete({ context, input: { id: FOREIGN } }),
      "NOT_FOUND"
    )
    expectNoWrites()
  })
})
