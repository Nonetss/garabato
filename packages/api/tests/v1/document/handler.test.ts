import { beforeEach, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import {
  type CertificateRow,
  certificateRow,
  documentRow,
  documentSignatureRow,
  documentVersionRow,
  stepArgs,
} from "@nonete/db/testing"
import type { z } from "zod"
import { errors } from "#errors"
import { certificateScope } from "#shared/certificate-secrets"
import { type VaultScope, vault } from "#shared/vault"
import { P12_PASSWORD, p12Fixture } from "#tests/fixtures/certificate-files"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { type PdfFixture, pdfFixture } from "#tests/fixtures/document-files"
import { expectErrorCode } from "#tests/fixtures/errors"
import { fakeObjectStorage } from "#tests/fixtures/object-storage"
import { verifySignatures } from "#tests/fixtures/pdf-signatures"
import { documentHandler, documentName, pdfName } from "#v1/document/handler"
import type { documentInput } from "#v1/document/input"

type SignInput = z.infer<typeof documentInput.sign>

const USER_ID = "user-id"
const DOC_ID = "00000000-0000-4000-8000-0000000000d1"
const V1_ID = "00000000-0000-4000-8000-0000000000e1"
const CERT_ID = "00000000-0000-4000-8000-0000000000c1"
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
      },
      {
        document: documentRow({ id: "00000000-0000-4000-8000-0000000000d2" }),
        versionCount: null,
        sizeBytes: null,
        signatureCount: null,
        lastSignedAt: null,
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
    })
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

    const result = await documentHandler.get({ context, input: { id: DOC_ID } })

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
    fakeDb.queue("select", [])

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
  test("shreds the key, soft-deletes and removes the objects", async () => {
    const { document, version } = await storedDocument()
    fakeDb.queue("update", [{ ...document, deletedAt: new Date() }])
    fakeDb.queue("query.documentVersions.findMany", [version])

    const result = await documentHandler.delete({
      context,
      input: { id: DOC_ID },
    })

    expect(result).toEqual({ id: DOC_ID, success: true })
    expect(written("update")).toMatchObject({ encryptedDataKey: null })
    expect(field(written("update"), "deletedAt")).toBeInstanceOf(Date)
    expect(fakeObjectStorage.objects.size).toBe(0)
  })

  test("still succeeds when an object cannot be removed", async () => {
    const { document, version } = await storedDocument()
    fakeDb.queue("update", [document])
    fakeDb.queue("query.documentVersions.findMany", [version])
    fakeObjectStorage.failNext("deleteObject", errors.BAD_GATEWAY())

    const result = await documentHandler.delete({
      context,
      input: { id: DOC_ID },
    })

    expect(result.success).toBe(true)
  })

  test("answers NOT_FOUND when nothing owned matches", async () => {
    fakeDb.queue("update", [])

    await expectErrorCode(
      documentHandler.delete({ context, input: { id: DOC_ID } }),
      "NOT_FOUND"
    )
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
