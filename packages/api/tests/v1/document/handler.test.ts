import { beforeEach, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import {
  type CertificateRow,
  certificateRow,
  documentFolderRow,
  documentRow,
  documentSignatureRow,
  documentVersionRow,
  stepArgs,
} from "@nonete/db/testing"
import type { z } from "zod"
import { errors } from "#errors"
import { certificateScope } from "#shared/certificate-secrets"
import { encodeKeysetCursor } from "#shared/pagination"
import { type VaultScope, vault } from "#shared/vault"
import { P12_PASSWORD, p12Fixture } from "#tests/fixtures/certificate-files"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { type PdfFixture, pdfFixture } from "#tests/fixtures/document-files"
import { expectErrorCode } from "#tests/fixtures/errors"
import { fakeObjectStorage } from "#tests/fixtures/object-storage"
import { verifySignatures } from "#tests/fixtures/pdf-signatures"
import { documentHandler, documentName, pdfName } from "#v1/document/handler"
import { documentInput } from "#v1/document/input"

type SignInput = z.infer<typeof documentInput.sign>

const USER_ID = "user-id"
const DOC_ID = "00000000-0000-4000-8000-0000000000d1"
const V1_ID = "00000000-0000-4000-8000-0000000000e1"
const CERT_ID = "00000000-0000-4000-8000-0000000000c1"
const DOC2_ID = "00000000-0000-4000-8000-0000000000d2"
const FOLDER_ID = "00000000-0000-4000-8000-0000000000a1"
const TAG_A = "00000000-0000-4000-8000-0000000000b1"
const TAG_B = "00000000-0000-4000-8000-0000000000b2"
const context = userContext()
const DOC_SCOPE: VaultScope = { kind: "document", id: DOC_ID }

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

function written(op: "insert" | "update", index = 0) {
  const call = fakeDb.calls(op)[index]
  if (!call) throw new Error(`no ${op} call #${index}`)
  const [values] = stepArgs(call, op === "insert" ? "values" : "set")
  if (typeof values !== "object" || values === null) {
    throw new Error("no values written")
  }
  return values
}

function field(values: object, key: string): unknown {
  return Object.entries(values).find(([name]) => name === key)?.[1]
}

function bytesOf(value: unknown) {
  if (!(value instanceof Uint8Array)) throw new Error("expected bytes")
  return value
}

// A stored document whose version 1 is `name`, sealed in the fake store.
async function storedDocument(name: PdfFixture = "plain") {
  const pdf = await pdfFixture(name)
  const dataKey = vault.newDataKey()
  const document = documentRow({
    id: DOC_ID,
    userId: USER_ID,
    encryptedDataKey: await vault.wrapDataKey(DOC_SCOPE, dataKey),
  })
  const version = documentVersionRow({
    id: V1_ID,
    documentId: DOC_ID,
    number: 1,
    objectKey: `documents/${DOC_ID}/v1`,
    sha256: sha256(pdf),
    sizeBytes: pdf.length,
  })
  fakeObjectStorage.objects.set(
    version.objectKey,
    await vault.seal(dataKey, DOC_SCOPE, "v1", pdf)
  )
  return { pdf, dataKey, document, version }
}

// A certificate row holding the RSA fixture, optionally with its password.
async function storedCertificate(
  remember: boolean,
  overrides: Partial<CertificateRow> = {}
) {
  const dataKey = vault.newDataKey()
  const scope = certificateScope(CERT_ID)
  const encryptedPassword = remember
    ? await vault.seal(
        dataKey,
        scope,
        "password",
        new TextEncoder().encode(P12_PASSWORD)
      )
    : null
  return certificateRow({
    id: CERT_ID,
    userId: USER_ID,
    notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    encryptedDataKey: await vault.wrapDataKey(scope, dataKey),
    encryptedP12: await vault.seal(
      dataKey,
      scope,
      "p12",
      await p12Fixture("rsa")
    ),
    encryptedPassword,
    ...overrides,
  })
}

function signInput(overrides: Partial<SignInput> = {}): SignInput {
  return {
    documentId: DOC_ID,
    baseVersionId: V1_ID,
    certificateId: CERT_ID,
    appearance: {
      visible: true,
      page: 0,
      pages: "one",
      rect: { x: 0.55, y: 0.8, width: 0.4, height: 0.12 },
    },
    ...overrides,
  }
}

beforeEach(() => {
  fakeDb.reset()
  fakeObjectStorage.reset()
})

describe("documentName", () => {
  test("keeps the base name and ensures .pdf", () => {
    expect(documentName("contrato.pdf")).toBe("contrato.pdf")
    expect(documentName("C:\\docs\\Contrato.PDF")).toBe("Contrato.PDF")
    expect(documentName("../../etc/acuerdo")).toBe("acuerdo.pdf")
    expect(documentName("a\u0000b\u001f.pdf")).toBe("ab.pdf")
    expect(documentName("   ")).toBe("documento.pdf")
  })
})

describe("pdfName", () => {
  test("strips control characters and ensures .pdf", () => {
    expect(pdfName("Contrato firmado")).toBe("Contrato firmado.pdf")
    expect(pdfName("Acuerdo.PDF")).toBe("Acuerdo.PDF")
    expect(pdfName("  a\u0007b  ")).toBe("ab.pdf")
    expect(pdfName("\u0000")).toBe("documento.pdf")
    expect(pdfName("x".repeat(300))).toBe(`${"x".repeat(196)}.pdf`)
  })
})

describe("document.upload", () => {
  test("stores version 1 encrypted and the rows in one transaction", async () => {
    const pdf = await pdfFixture("plain")
    fakeDb.queue("insert", [documentRow({ id: DOC_ID })])
    fakeDb.queue("insert", [documentVersionRow({ sizeBytes: pdf.length })])

    const result = await documentHandler.upload({
      context,
      input: { file: new File([pdf], "contrato.pdf") },
    })

    expect(result).toMatchObject({ versionCount: 1, signatureCount: 0 })
    const document = written("insert", 0)
    expect(document).toMatchObject({
      userId: USER_ID,
      name: "contrato.pdf",
      pageCount: 3,
    })
    expect(written("insert", 1)).toMatchObject({
      number: 1,
      sizeBytes: pdf.length,
      sha256: sha256(pdf),
    })

    const id = field(document, "id")
    if (typeof id !== "string") throw new Error("no id")
    const scope: VaultScope = { kind: "document", id }
    const [object] = [...fakeObjectStorage.objects.values()]
    expect(Buffer.from(bytesOf(object)).includes(Buffer.from("%PDF"))).toBe(
      false
    )
    const dataKey = await vault.unwrapDataKey(
      scope,
      bytesOf(field(document, "encryptedDataKey"))
    )
    expect(await vault.open(dataKey, scope, "v1", bytesOf(object))).toEqual(pdf)
  })

  test.each([
    ["not-a-pdf", "no es un PDF"],
    ["encrypted", "protegido con contraseña"],
  ] satisfies [PdfFixture, string][])("rejects %s", async (name, message) => {
    const error = await documentHandler
      .upload({
        context,
        input: { file: new File([await pdfFixture(name)], `${name}.pdf`) },
      })
      .then(
        () => undefined,
        (thrown: unknown) => thrown
      )

    await expectErrorCode(Promise.reject(error), "BAD_REQUEST")
    expect(String(error)).toContain(message)
    expect(fakeDb.calls()).toEqual([])
    expect(fakeObjectStorage.objects.size).toBe(0)
  })

  test("removes the object when the transaction fails", async () => {
    fakeDb.queueError("insert", new Error("database down"))

    await documentHandler
      .upload({
        context,
        input: { file: new File([await pdfFixture("plain")], "a.pdf") },
      })
      .catch(() => undefined)

    expect(fakeObjectStorage.objects.size).toBe(0)
  })

  test("writes no row when the store is unavailable", async () => {
    fakeObjectStorage.failNext("putObject", errors.SERVICE_UNAVAILABLE())

    await expectErrorCode(
      documentHandler.upload({
        context,
        input: { file: new File([await pdfFixture("plain")], "a.pdf") },
      }),
      "SERVICE_UNAVAILABLE"
    )
    expect(fakeDb.calls()).toEqual([])
  })

  test("puts the document in the root when no folder is given", async () => {
    fakeDb.queue("insert", [documentRow({ id: DOC_ID })])
    fakeDb.queue("insert", [documentVersionRow()])

    const result = await documentHandler.upload({
      context,
      input: { file: new File([await pdfFixture("plain")], "a.pdf") },
    })

    expect(written("insert", 0)).toMatchObject({ folderId: null })
    expect(result).toMatchObject({ folderId: null, tagIds: [], pinnedAt: null })
  })

  test("uploads into one of the caller's folders", async () => {
    fakeDb.queue("query.documentFolders.findFirst", documentFolderRow())
    fakeDb.queue("insert", [documentRow({ folderId: FOLDER_ID })])
    fakeDb.queue("insert", [documentVersionRow()])

    const result = await documentHandler.upload({
      context,
      input: {
        file: new File([await pdfFixture("plain")], "a.pdf"),
        folderId: FOLDER_ID,
      },
    })

    const [call] = fakeDb.calls("query.documentFolders.findFirst")
    expect(call && stepArgs(call, "findFirst")[0]).toEqual({
      where: { id: FOLDER_ID, userId: USER_ID },
    })
    expect(written("insert", 0)).toMatchObject({ folderId: FOLDER_ID })
    expect(result.folderId).toBe(FOLDER_ID)
  })

  test("stores nothing for a folder that isn't the caller's", async () => {
    fakeDb.queue("query.documentFolders.findFirst", undefined)

    await expectErrorCode(
      documentHandler.upload({
        context,
        input: {
          file: new File([await pdfFixture("plain")], "a.pdf"),
          folderId: FOLDER_ID,
        },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("insert")).toEqual([])
    expect(fakeObjectStorage.objects.size).toBe(0)
  })
})

describe("document.list", () => {
  test("maps documents and their aggregates", async () => {
    fakeDb.queue("select", [
      {
        document: documentRow({ id: DOC_ID }),
        versionCount: 2,
        sizeBytes: 4096,
        signatureCount: 1,
        lastSignedAt: new Date("2026-02-01T10:00:00.000Z"),
        tagIds: [TAG_A, TAG_B],
      },
      {
        document: documentRow({ id: DOC2_ID }),
        versionCount: null,
        sizeBytes: null,
        signatureCount: null,
        lastSignedAt: null,
        tagIds: null,
      },
    ])

    const list = await documentHandler.list({ context })

    expect(list[0]).toMatchObject({
      versionCount: 2,
      sizeBytes: 4096,
      signatureCount: 1,
      lastSignedAt: "2026-02-01T10:00:00.000Z",
    })
    expect(list[1]).toMatchObject({
      versionCount: 0,
      signatureCount: 0,
      lastSignedAt: null,
      tagIds: [],
    })
  })

  test("returns the folder, tags and pin time", async () => {
    const pinnedAt = new Date("2026-03-01T09:00:00.000Z")
    fakeDb.queue("select", [
      {
        document: documentRow({ folderId: FOLDER_ID, pinnedAt }),
        versionCount: 1,
        sizeBytes: 10,
        signatureCount: 0,
        lastSignedAt: null,
        tagIds: [TAG_A],
      },
    ])

    const [document] = await documentHandler.list({ context })

    expect(document).toMatchObject({
      folderId: FOLDER_ID,
      tagIds: [TAG_A],
      pinnedAt: "2026-03-01T09:00:00.000Z",
    })
  })

  test("orders pinned documents first, then newest first", async () => {
    fakeDb.queue("select", [])

    await documentHandler.list({ context })

    const [call] = fakeDb.calls("select")
    expect(call && stepArgs(call, "orderBy")).toHaveLength(2)
  })
})

describe("document.get", () => {
  test("returns versions and signature records", async () => {
    const { document, version } = await storedDocument()
    const signed = documentVersionRow({
      id: "00000000-0000-4000-8000-0000000000e2",
      number: 2,
    })
    fakeDb.queue("query.documents.findFirst", document)
    fakeDb.queue("query.documentVersions.findMany", [version, signed])
    fakeDb.queue("select", [
      {
        signature: documentSignatureRow({ versionId: signed.id }),
        documentName: document.name,
        documentDeletedAt: null,
        versionNumber: 2,
        certificateAlias: "Personal",
        certificateHolder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
      },
    ])
    fakeDb.queue("select", [{ tagId: TAG_A }])

    const result = await documentHandler.get({ context, input: { id: DOC_ID } })

    expect(result.tagIds).toEqual([TAG_A])
    expect(result.versions.map((entry) => entry.number)).toEqual([1, 2])
    expect(result).toMatchObject({ versionCount: 2, signatureCount: 1 })
    expect(result.signatures[0]).toMatchObject({
      versionNumber: 2,
      certificateAlias: "Personal",
      documentDeleted: false,
    })
  })

  test("answers NOT_FOUND for another user's document", async () => {
    fakeDb.queue("query.documents.findFirst", undefined)

    await expectErrorCode(
      documentHandler.get({ context, input: { id: DOC_ID } }),
      "NOT_FOUND"
    )
    const [call] = fakeDb.calls("query.documents.findFirst")
    expect(call && stepArgs(call, "findFirst")[0]).toEqual({
      where: { id: DOC_ID, userId: USER_ID, deletedAt: { isNull: true } },
    })
  })
})

describe("document.download", () => {
  test("returns the current version byte for byte", async () => {
    const { pdf, document, version } = await storedDocument()
    fakeDb.queue("query.documents.findFirst", document)
    fakeDb.queue("query.documentVersions.findMany", [version])

    const file = await documentHandler.download({
      context,
      input: { id: DOC_ID },
    })

    expect(file.name).toBe("contrato.pdf")
    expect(file.type).toBe("application/pdf")
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(pdf)
  })

  test("names earlier versions with their number", async () => {
    const { dataKey, document, version } = await storedDocument()
    const v2 = documentVersionRow({ number: 2, objectKey: "documents/x/v2" })
    fakeObjectStorage.objects.set(
      v2.objectKey,
      await vault.seal(dataKey, DOC_SCOPE, "v2", Uint8Array.of(1))
    )
    fakeDb.queue("query.documents.findFirst", document)
    fakeDb.queue("query.documentVersions.findMany", [version, v2])

    const file = await documentHandler.download({
      context,
      input: { id: DOC_ID, versionNumber: 1 },
    })

    expect(file.name).toBe("contrato (v1).pdf")
  })

  test("answers NOT_FOUND for a missing version", async () => {
    const { document, version } = await storedDocument()
    fakeDb.queue("query.documents.findFirst", document)
    fakeDb.queue("query.documentVersions.findMany", [version])

    await expectErrorCode(
      documentHandler.download({
        context,
        input: { id: DOC_ID, versionNumber: 5 },
      }),
      "NOT_FOUND"
    )
  })

  test("refuses an object copied from another version", async () => {
    const { dataKey, document, version } = await storedDocument()
    const v2 = documentVersionRow({ number: 2, objectKey: "documents/x/v2" })
    // v1's sealed bytes placed where v2 should be.
    fakeObjectStorage.objects.set(
      v2.objectKey,
      await vault.seal(dataKey, DOC_SCOPE, "v1", Uint8Array.of(1))
    )
    fakeDb.queue("query.documents.findFirst", document)
    fakeDb.queue("query.documentVersions.findMany", [version, v2])

    await expectErrorCode(
      documentHandler.download({ context, input: { id: DOC_ID } }),
      "INTERNAL_SERVER_ERROR"
    )
  })
})

describe("document.rename", () => {
  test("renames an owned document and returns its summary", async () => {
    const { document, version } = await storedDocument()
    fakeDb.queue("update", [{ ...document, name: "Contrato final.pdf" }])
    fakeDb.queue("query.documentVersions.findMany", [version])
    fakeDb.queue("select", [], [])

    const result = await documentHandler.rename({
      context,
      input: { id: DOC_ID, name: "Contrato final" },
    })

    expect(written("update")).toEqual({ name: "Contrato final.pdf" })
    expect(result).toMatchObject({
      id: DOC_ID,
      name: "Contrato final.pdf",
      versionCount: 1,
      signatureCount: 0,
      sizeBytes: version.sizeBytes,
    })
  })

  test("answers NOT_FOUND when nothing owned matches", async () => {
    fakeDb.queue("update", [])

    await expectErrorCode(
      documentHandler.rename({
        context,
        input: { id: DOC_ID, name: "Otro" },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("query.documentVersions.findMany")).toEqual([])
  })
})

describe("document.delete", () => {
  test("shreds the key, drops tags and pin, soft-deletes and removes the objects", async () => {
    const { document, version } = await storedDocument()
    fakeDb.queue("select", [{ id: DOC_ID }])
    fakeDb.queue("update", [{ id: document.id }])
    fakeDb.queue("delete", [])
    fakeDb.queue("query.documentVersions.findMany", [version])

    const result = await documentHandler.delete({
      context,
      input: { id: DOC_ID },
    })

    expect(result).toEqual({ id: DOC_ID, success: true })
    expect(written("update")).toMatchObject({
      encryptedDataKey: null,
      pinnedAt: null,
    })
    expect(field(written("update"), "deletedAt")).toBeInstanceOf(Date)
    expect(fakeDb.calls("delete")).toHaveLength(1)
    expect(fakeObjectStorage.objects.size).toBe(0)
  })

  test("still succeeds when an object cannot be removed", async () => {
    const { version } = await storedDocument()
    fakeDb.queue("select", [{ id: DOC_ID }])
    fakeDb.queue("update", [{ id: DOC_ID }])
    fakeDb.queue("delete", [])
    fakeDb.queue("query.documentVersions.findMany", [version])
    fakeObjectStorage.failNext("deleteObject", errors.BAD_GATEWAY())

    const result = await documentHandler.delete({
      context,
      input: { id: DOC_ID },
    })

    expect(result.success).toBe(true)
  })

  test("answers NOT_FOUND when nothing owned matches", async () => {
    fakeDb.queue("select", [])

    await expectErrorCode(
      documentHandler.delete({ context, input: { id: DOC_ID } }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("update")).toEqual([])
  })
})

describe("document.deleteMany", () => {
  test("deletes every listed document once", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }, { id: DOC2_ID }])
    fakeDb.queue("update", [{ id: DOC_ID }, { id: DOC2_ID }])
    fakeDb.queue("delete", [])
    fakeDb.queue("query.documentVersions.findMany", [])

    const result = await documentHandler.deleteMany({
      context,
      input: { ids: [DOC_ID, DOC2_ID, DOC_ID] },
    })

    expect(result).toEqual({ ids: [DOC_ID, DOC2_ID], success: true })
    expect(fakeDb.calls("delete")).toHaveLength(1)
  })

  test("deletes nothing when one of them isn't the caller's", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }])

    await expectErrorCode(
      documentHandler.deleteMany({
        context,
        input: { ids: [DOC_ID, DOC2_ID] },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("update")).toEqual([])
    expect(fakeDb.calls("delete")).toEqual([])
  })

  test("rolls back when a concurrent delete took one of them", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }, { id: DOC2_ID }])
    fakeDb.queue("update", [{ id: DOC_ID }])

    await expectErrorCode(
      documentHandler.deleteMany({
        context,
        input: { ids: [DOC_ID, DOC2_ID] },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("delete")).toEqual([])
  })
})

describe("document.move", () => {
  test("moves a selection into one of the caller's folders", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }, { id: DOC2_ID }])
    fakeDb.queue("query.documentFolders.findFirst", documentFolderRow())
    fakeDb.queue("update", [])

    const result = await documentHandler.move({
      context,
      input: { ids: [DOC_ID, DOC2_ID], folderId: FOLDER_ID },
    })

    expect(result).toEqual({ ids: [DOC_ID, DOC2_ID], success: true })
    expect(written("update")).toEqual({ folderId: FOLDER_ID })
  })

  test("moves documents to the library root", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }])
    fakeDb.queue("update", [])

    await documentHandler.move({
      context,
      input: { ids: [DOC_ID], folderId: null },
    })

    expect(written("update")).toEqual({ folderId: null })
    expect(fakeDb.calls("query.documentFolders.findFirst")).toEqual([])
  })

  test("moves nothing when one document isn't the caller's", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }])

    await expectErrorCode(
      documentHandler.move({
        context,
        input: { ids: [DOC_ID, DOC2_ID], folderId: null },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("update")).toEqual([])
  })

  test("moves nothing into a folder that isn't the caller's", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }])
    fakeDb.queue("query.documentFolders.findFirst", undefined)

    await expectErrorCode(
      documentHandler.move({
        context,
        input: { ids: [DOC_ID], folderId: FOLDER_ID },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("update")).toEqual([])
  })
})

describe("document.updateTags", () => {
  test("adds and removes tags together on every document", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }, { id: DOC2_ID }])
    fakeDb.queue("select", [{ id: TAG_A }, { id: TAG_B }])
    fakeDb.queue("insert", [])
    fakeDb.queue("delete", [])

    const result = await documentHandler.updateTags({
      context,
      input: { ids: [DOC_ID, DOC2_ID], add: [TAG_A], remove: [TAG_B] },
    })

    expect(result.ids).toEqual([DOC_ID, DOC2_ID])
    expect(written("insert")).toEqual([
      { documentId: DOC_ID, tagId: TAG_A },
      { documentId: DOC2_ID, tagId: TAG_A },
    ])
    const [insert] = fakeDb.calls("insert")
    expect(insert?.steps.map((step) => step.method)).toContain(
      "onConflictDoNothing"
    )
    expect(fakeDb.calls("delete")).toHaveLength(1)
  })

  test("only removes when nothing is added", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }])
    fakeDb.queue("select", [{ id: TAG_B }])
    fakeDb.queue("delete", [])

    await documentHandler.updateTags({
      context,
      input: { ids: [DOC_ID], add: [], remove: [TAG_B] },
    })

    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("changes nothing when one document isn't the caller's", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }])

    await expectErrorCode(
      documentHandler.updateTags({
        context,
        input: { ids: [DOC_ID, DOC2_ID], add: [TAG_A], remove: [] },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("insert")).toEqual([])
    expect(fakeDb.calls("delete")).toEqual([])
  })

  test("changes nothing when a tag isn't the caller's", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }])
    fakeDb.queue("select", [{ id: TAG_A }])

    await expectErrorCode(
      documentHandler.updateTags({
        context,
        input: { ids: [DOC_ID], add: [TAG_A], remove: [TAG_B] },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("insert")).toEqual([])
    expect(fakeDb.calls("delete")).toEqual([])
  })

  test.each([
    ["no tag at all", { add: [], remove: [] }],
    ["a tag both added and removed", { add: [TAG_A], remove: [TAG_A] }],
  ])("rejects %s", (_, tags) => {
    const parsed = documentInput.updateTags.safeParse({
      ids: [DOC_ID],
      ...tags,
    })
    expect(parsed.success).toBe(false)
  })
})

describe("document.setPinned", () => {
  test("pins keeping the first pin moment", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }])
    fakeDb.queue("update", [])

    const result = await documentHandler.setPinned({
      context,
      input: { ids: [DOC_ID], pinned: true },
    })

    expect(result).toEqual({ ids: [DOC_ID], success: true })
    // A coalesce over the stored value, not a fresh timestamp.
    expect(field(written("update"), "pinnedAt")).not.toBeInstanceOf(Date)
    expect(field(written("update"), "pinnedAt")).not.toBeNull()
  })

  test("unpins", async () => {
    fakeDb.queue("select", [{ id: DOC_ID }])
    fakeDb.queue("update", [])

    await documentHandler.setPinned({
      context,
      input: { ids: [DOC_ID], pinned: false },
    })

    expect(written("update")).toEqual({ pinnedAt: null })
  })

  test("changes nothing when one document isn't the caller's", async () => {
    fakeDb.queue("select", [])

    await expectErrorCode(
      documentHandler.setPinned({
        context,
        input: { ids: [DOC_ID], pinned: true },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("update")).toEqual([])
  })
})

describe("document.sign", () => {
  async function arrange(options: {
    remember: boolean
    certificate?: Partial<CertificateRow>
  }) {
    const stored = await storedDocument()
    fakeDb.queue("query.documents.findFirst", stored.document)
    fakeDb.queue("query.documentVersions.findMany", [stored.version])
    fakeDb.queue(
      "query.certificates.findFirst",
      await storedCertificate(options.remember, options.certificate)
    )
    return stored
  }

  function queueCommit() {
    fakeDb.queue(
      "insert",
      [
        documentVersionRow({
          id: "00000000-0000-4000-8000-0000000000e2",
          number: 2,
        }),
      ],
      [documentSignatureRow()]
    )
    fakeDb.queue("update", [])
  }

  test("signs with the remembered password and stores version 2", async () => {
    const { pdf, dataKey } = await arrange({ remember: true })
    queueCommit()
    const signingContext = {
      ...context,
      headers: new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
    }

    const result = await documentHandler.sign({
      context: signingContext,
      input: signInput(),
    })

    expect(result.version.number).toBe(2)
    const object = fakeObjectStorage.objects.get(`documents/${DOC_ID}/v2`)
    const signedPdf = await vault.open(
      dataKey,
      DOC_SCOPE,
      "v2",
      bytesOf(object)
    )
    expect(signedPdf.subarray(0, pdf.length)).toEqual(pdf)
    const [signature] = await verifySignatures(signedPdf)
    expect(signature).toMatchObject({ intact: true, coversWholeDocument: true })

    expect(written("insert", 0)).toMatchObject({
      documentId: DOC_ID,
      number: 2,
      sha256: sha256(signedPdf),
      sizeBytes: signedPdf.length,
    })
    expect(written("insert", 1)).toMatchObject({
      certificateId: CERT_ID,
      userId: USER_ID,
      visible: true,
      pages: [0],
      sha256Before: sha256(pdf),
      ipAddress: "203.0.113.7",
    })
  })

  test("signs invisibly with a typed password", async () => {
    await arrange({ remember: false })
    queueCommit()

    await documentHandler.sign({
      context,
      input: signInput({
        password: P12_PASSWORD,
        appearance: { visible: false },
      }),
    })

    expect(written("insert", 1)).toMatchObject({
      visible: false,
      pages: [],
      rect: null,
    })
  })

  test("asks for the password when none is remembered or sent", async () => {
    await arrange({ remember: false })

    await expectErrorCode(
      documentHandler.sign({ context, input: signInput() }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls("insert")).toEqual([])
    expect(fakeObjectStorage.objects.size).toBe(1)
  })

  test("rejects a wrong password", async () => {
    await arrange({ remember: false })

    await expectErrorCode(
      documentHandler.sign({
        context,
        input: signInput({ password: "wrong" }),
      }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("rejects a document changed since it was opened", async () => {
    const { document, version } = await storedDocument()
    fakeDb.queue("query.documents.findFirst", document)
    fakeDb.queue("query.documentVersions.findMany", [
      version,
      documentVersionRow({
        id: "00000000-0000-4000-8000-0000000000e2",
        number: 2,
      }),
    ])

    await expectErrorCode(
      documentHandler.sign({ context, input: signInput() }),
      "CONFLICT"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("rejects an expired certificate", async () => {
    await arrange({
      remember: true,
      certificate: { notAfter: new Date("2020-01-01T00:00:00.000Z") },
    })

    await expectErrorCode(
      documentHandler.sign({ context, input: signInput() }),
      "CONFLICT"
    )
  })

  test("answers NOT_FOUND for another user's certificate", async () => {
    const { document, version } = await storedDocument()
    fakeDb.queue("query.documents.findFirst", document)
    fakeDb.queue("query.documentVersions.findMany", [version])
    fakeDb.queue("query.certificates.findFirst", undefined)

    await expectErrorCode(
      documentHandler.sign({ context, input: signInput() }),
      "NOT_FOUND"
    )
  })

  test("rejects a stamp on a page the document does not have", async () => {
    await arrange({ remember: true })

    await expectErrorCode(
      documentHandler.sign({
        context,
        input: signInput({
          appearance: {
            visible: true,
            page: 9,
            pages: "one",
            rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
          },
        }),
      }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("maps a version race to CONFLICT and removes the object", async () => {
    await arrange({ remember: true })
    fakeDb.queueError("insert", { cause: { code: "23505" } })

    await expectErrorCode(
      documentHandler.sign({ context, input: signInput() }),
      "CONFLICT"
    )
    expect(fakeObjectStorage.objects.has(`documents/${DOC_ID}/v2`)).toBe(false)
  })
})

describe("document.signatures", () => {
  test("lists a certificate's records, deleted documents included", async () => {
    fakeDb.queue(
      "query.certificates.findFirst",
      certificateRow({ id: CERT_ID })
    )
    fakeDb.queue("select", [
      {
        signature: documentSignatureRow(),
        documentName: "viejo.pdf",
        documentDeletedAt: new Date(),
        versionNumber: 2,
        certificateAlias: "Personal",
        certificateHolder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
      },
    ])

    const records = await documentHandler.signatures({
      context,
      input: { certificateId: CERT_ID },
    })

    expect(records[0]).toMatchObject({
      documentName: "viejo.pdf",
      documentDeleted: true,
    })
  })

  test("answers NOT_FOUND for another user's document", async () => {
    fakeDb.queue("query.documents.findFirst", undefined)

    await expectErrorCode(
      documentHandler.signatures({ context, input: { documentId: DOC_ID } }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("select")).toEqual([])
  })
})

// A row of the signature join, as the log query returns it.
function logRow(
  index: number,
  overrides: { documentDeletedAt?: Date; certificateDeletedAt?: Date } = {}
) {
  const certificate = certificateRow({ id: CERT_ID })
  return {
    signature: documentSignatureRow({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      signedAt: new Date(Date.UTC(2026, 9, 7, 12, 0, 60 - index)),
    }),
    documentName: `doc-${index}.pdf`,
    documentDeletedAt: overrides.documentDeletedAt ?? null,
    versionNumber: 2,
    certificateAlias: certificate.alias,
    certificateHolder: certificate.commonName,
    certificateDeletedAt: overrides.certificateDeletedAt ?? null,
    certificateTaxId: certificate.taxId,
    certificateIssuer: certificate.issuerCommonName,
    certificateSerialNumber: certificate.serialNumber,
    certificateFingerprint: certificate.fingerprintSha256,
    certificateNotBefore: certificate.notBefore,
    certificateNotAfter: certificate.notAfter,
  }
}

function logInput(
  overrides: Partial<z.input<typeof documentInput.signatureLog>> = {}
) {
  return documentInput.signatureLog.parse({ limit: 2, ...overrides })
}

describe("document.signatureLog", () => {
  test("returns records with certificate data, the total and no cursor on the last page", async () => {
    fakeDb.queue("select", [logRow(1)])
    fakeDb.queue("select", [{ total: 1 }])

    const result = await documentHandler.signatureLog({
      context,
      input: logInput(),
    })

    expect(result).toEqual({
      records: [
        expect.objectContaining({
          documentName: "doc-1.pdf",
          documentDeleted: false,
          certificateAlias: "Personal",
          certificateDeleted: false,
          certificateTaxId: "12345678Z",
          certificateIssuer: "AC PRUEBAS AUTOFIRMAS",
          certificateSerialNumber: "1DA4064E22D19F8E5ADFA4F4A5C540E11AE51FB9",
          certificateFingerprint:
            "79e9b2ecc60d29095afd435a404e828b5b84bb91e1c3a19e435c5650444148dc",
          certificateNotBefore: "2025-01-01T00:00:00.000Z",
          certificateNotAfter: "2027-01-01T00:00:00.000Z",
        }),
      ],
      total: 1,
      nextCursor: null,
    })
  })

  test("pages by cursor without repeating or skipping records", async () => {
    const rows = [logRow(1), logRow(2), logRow(3)]
    fakeDb.queue("select", rows)
    fakeDb.queue("select", [{ total: 3 }])

    const first = await documentHandler.signatureLog({
      context,
      input: logInput(),
    })

    const second = rows[1]
    if (!second) throw new Error("missing row")
    expect(first.records.map((record) => record.documentName)).toEqual([
      "doc-1.pdf",
      "doc-2.pdf",
    ])
    expect(first.total).toBe(3)
    expect(first.nextCursor).toBe(
      encodeKeysetCursor(second.signature.signedAt, second.signature.id)
    )

    fakeDb.queue("select", [logRow(3)])
    fakeDb.queue("select", [{ total: 3 }])
    const next = await documentHandler.signatureLog({
      context,
      input: logInput({ cursor: first.nextCursor }),
    })

    expect(next.records.map((record) => record.documentName)).toEqual([
      "doc-3.pdf",
    ])
    expect(next.nextCursor).toBeNull()
  })

  test("flags records of deleted documents and certificates", async () => {
    fakeDb.queue("select", [
      logRow(1, {
        documentDeletedAt: new Date(),
        certificateDeletedAt: new Date(),
      }),
    ])
    fakeDb.queue("select", [{ total: 1 }])

    const result = await documentHandler.signatureLog({
      context,
      input: logInput(),
    })

    expect(result.records[0]).toMatchObject({
      documentDeleted: true,
      certificateDeleted: true,
      certificateHolder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
    })
  })

  test("returns an empty page when nothing matches", async () => {
    fakeDb.queue("select", [])
    fakeDb.queue("select", [{ total: 0 }])

    const result = await documentHandler.signatureLog({
      context,
      input: logInput({ query: "100%" }),
    })

    expect(result).toEqual({ records: [], total: 0, nextCursor: null })
  })

  test("filters by one of the caller's certificates, deleted included", async () => {
    fakeDb.queue(
      "query.certificates.findFirst",
      certificateRow({ id: CERT_ID, deletedAt: new Date() })
    )
    fakeDb.queue("select", [logRow(1)])
    fakeDb.queue("select", [{ total: 1 }])

    const result = await documentHandler.signatureLog({
      context,
      input: logInput({ certificateId: CERT_ID }),
    })

    expect(result.total).toBe(1)
  })

  test("answers NOT_FOUND for another user's certificate", async () => {
    fakeDb.queue("query.certificates.findFirst", undefined)

    await expectErrorCode(
      documentHandler.signatureLog({
        context,
        input: logInput({ certificateId: CERT_ID }),
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("select")).toEqual([])
  })

  test("rejects a malformed cursor with BAD_REQUEST", async () => {
    await expectErrorCode(
      documentHandler.signatureLog({
        context,
        input: logInput({ cursor: "not-a-cursor" }),
      }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls("select")).toEqual([])
  })

  test("accepts a range whose start is before its end", () => {
    const result = documentInput.signatureLog.safeParse({
      signedFrom: "2026-10-01T00:00:00.000Z",
      signedBefore: "2026-10-08T00:00:00.000Z",
    })

    expect(result.success).toBe(true)
  })

  test("rejects a range whose start is not before its end", () => {
    const same = documentInput.signatureLog.safeParse({
      signedFrom: "2026-10-08T00:00:00.000Z",
      signedBefore: "2026-10-08T00:00:00.000Z",
    })
    const inverted = documentInput.signatureLog.safeParse({
      signedFrom: "2026-10-09T00:00:00.000Z",
      signedBefore: "2026-10-08T00:00:00.000Z",
    })

    expect(same.success).toBe(false)
    expect(inverted.success).toBe(false)
  })
})

describe("document.signatureLogCertificates", () => {
  test("lists the certificates used to sign, flagging deleted ones", async () => {
    fakeDb.queue("select", [
      {
        id: CERT_ID,
        alias: "Personal",
        holder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
        deletedAt: new Date(),
      },
      {
        id: "00000000-0000-4000-8000-0000000000c2",
        alias: "Trabajo",
        holder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
        deletedAt: null,
      },
    ])

    const result = await documentHandler.signatureLogCertificates({ context })

    expect(result).toEqual([
      {
        id: CERT_ID,
        alias: "Personal",
        holder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
        deleted: true,
      },
      {
        id: "00000000-0000-4000-8000-0000000000c2",
        alias: "Trabajo",
        holder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
        deleted: false,
      },
    ])
  })
})
