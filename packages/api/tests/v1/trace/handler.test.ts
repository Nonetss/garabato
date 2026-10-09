import { beforeEach, describe, expect, test } from "bun:test"
import {
  certificateRow,
  documentSignatureRow,
  stepArgs,
} from "@nonete/db/testing"
import type { z } from "zod"
import { encodeKeysetCursor } from "#shared/pagination"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { expectErrorCode } from "#tests/fixtures/errors"
import { traceHandler } from "#v1/trace/handler"
import { traceInput } from "#v1/trace/input"

const context = userContext()
const USER_ID = "user-id"
const DOC_ID = "00000000-0000-4000-8000-0000000000d1"
const CERT_ID = "00000000-0000-4000-8000-0000000000c1"
const VERSION_ID = "00000000-0000-4000-8000-0000000000e1"
const FOLDER_ID = "00000000-0000-4000-8000-0000000000a1"
const certificate = certificateRow({ id: CERT_ID })

function entryId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
}

// A row of the trail subquery joined to its document, certificate and version.
function trailRow(
  index: number,
  overrides: Partial<{
    type: string
    details: unknown
    ipAddress: string | null
    documentId: string | null
    documentDeletedAt: Date | null
    certificateId: string | null
    certificateDeletedAt: Date | null
    versionId: string | null
  }> = {}
) {
  const documentId = overrides.documentId === undefined ? DOC_ID : null
  const certificateId =
    overrides.certificateId === undefined ? null : overrides.certificateId
  const versionId =
    overrides.versionId === undefined ? VERSION_ID : overrides.versionId
  return {
    id: entryId(index),
    type: overrides.type ?? "document.uploaded",
    occurredAt: new Date(Date.UTC(2026, 9, 7, 12, 0, 60 - index)),
    ipAddress: overrides.ipAddress ?? null,
    details: overrides.details ?? null,
    documentId,
    documentName: documentId === null ? null : "contrato.pdf",
    documentDeletedAt: overrides.documentDeletedAt ?? null,
    certificateId,
    certificateAlias: certificateId === null ? null : certificate.alias,
    certificateHolder: certificateId === null ? null : certificate.commonName,
    certificateDeletedAt: overrides.certificateDeletedAt ?? null,
    versionId,
    versionNumber: versionId === null ? null : 1,
  }
}

function certificateTrailRow(index: number, type: string, details?: unknown) {
  return trailRow(index, {
    type,
    details,
    documentId: null,
    certificateId: CERT_ID,
    versionId: null,
  })
}

function signatureLogRow(id: string) {
  return {
    signature: documentSignatureRow({ id, certificateId: CERT_ID }),
    documentName: "contrato.pdf",
    documentDeletedAt: null,
    versionNumber: 2,
    certificateAlias: certificate.alias,
    certificateHolder: certificate.commonName,
    certificateDeletedAt: null,
    certificateTaxId: certificate.taxId,
    certificateIssuer: certificate.issuerCommonName,
    certificateSerialNumber: certificate.serialNumber,
    certificateFingerprint: certificate.fingerprintSha256,
    certificateNotBefore: certificate.notBefore,
    certificateNotAfter: certificate.notAfter,
  }
}

function listInput(overrides: Partial<z.input<typeof traceInput.list>> = {}) {
  return traceInput.list.parse({ limit: 2, ...overrides })
}

beforeEach(() => fakeDb.reset())

describe("trace.list", () => {
  test("maps each type with its document, certificate, version and details", async () => {
    fakeDb.queue("select", [
      trailRow(1, {
        type: "document.renamed",
        details: { from: "a.pdf", to: "contrato.pdf" },
        ipAddress: "203.0.113.7",
      }),
      certificateTrailRow(2, "certificate.imported"),
    ])
    fakeDb.queue("select", [{ total: 2 }])

    const result = await traceHandler.list({
      context,
      input: listInput(),
    })

    expect(result).toEqual({
      entries: [
        {
          id: entryId(1),
          type: "document.renamed",
          occurredAt: "2026-10-07T12:00:59.000Z",
          ipAddress: "203.0.113.7",
          document: { id: DOC_ID, name: "contrato.pdf", deleted: false },
          certificate: null,
          version: { id: VERSION_ID, number: 1 },
          details: { from: "a.pdf", to: "contrato.pdf" },
        },
        {
          id: entryId(2),
          type: "certificate.imported",
          occurredAt: "2026-10-07T12:00:58.000Z",
          ipAddress: null,
          document: null,
          certificate: {
            id: CERT_ID,
            alias: certificate.alias,
            holder: certificate.commonName,
            deleted: false,
          },
          version: null,
          details: null,
        },
      ],
      total: 2,
      nextCursor: null,
    })
  })

  test("keeps the details of moves and merges", async () => {
    fakeDb.queue("select", [
      trailRow(1, {
        type: "document.moved",
        details: { from: { id: FOLDER_ID, name: "2025" }, to: null },
      }),
      trailRow(2, {
        type: "document.merged",
        details: { sources: [{ id: DOC_ID, name: "a.pdf" }] },
      }),
    ])
    fakeDb.queue("select", [{ total: 2 }])

    const result = await traceHandler.list({ context, input: listInput() })

    expect(result.entries.map((entry) => entry.details)).toEqual([
      { from: { id: FOLDER_ID, name: "2025" }, to: null },
      { sources: [{ id: DOC_ID, name: "a.pdf" }] },
    ])
  })

  test("adds the full signature record to document.signed entries", async () => {
    const signatureId = entryId(1)
    fakeDb.queue("select", [
      trailRow(1, { type: "document.signed", certificateId: CERT_ID }),
    ])
    fakeDb.queue("select", [{ total: 1 }])
    fakeDb.queue("select", [signatureLogRow(signatureId)])

    const result = await traceHandler.list({ context, input: listInput() })

    expect(result.entries).toEqual([
      expect.objectContaining({
        type: "document.signed",
        details: null,
        signature: expect.objectContaining({
          id: signatureId,
          documentName: "contrato.pdf",
          certificateAlias: certificate.alias,
          certificateFingerprint: certificate.fingerprintSha256,
        }),
      }),
    ])
  })

  test("reads no signature records when the page has none", async () => {
    fakeDb.queue("select", [trailRow(1)])
    fakeDb.queue("select", [{ total: 1 }])

    await traceHandler.list({ context, input: listInput() })

    expect(fakeDb.calls("select")).toHaveLength(2)
  })

  test("pages by cursor without repeating or skipping entries", async () => {
    const rows = [trailRow(1), trailRow(2), trailRow(3)]
    fakeDb.queue("select", rows)
    fakeDb.queue("select", [{ total: 3 }])

    const first = await traceHandler.list({ context, input: listInput() })

    const second = rows[1]
    if (!second) throw new Error("missing row")
    expect(first.entries.map((entry) => entry.id)).toEqual([
      entryId(1),
      entryId(2),
    ])
    expect(first.total).toBe(3)
    expect(first.nextCursor).toBe(
      encodeKeysetCursor(second.occurredAt, second.id)
    )

    fakeDb.queue("select", [trailRow(3)])
    fakeDb.queue("select", [{ total: 3 }])
    const next = await traceHandler.list({
      context,
      input: listInput({ cursor: first.nextCursor }),
    })

    expect(next.entries.map((entry) => entry.id)).toEqual([entryId(3)])
    expect(next.nextCursor).toBeNull()
  })

  test("flags entries of deleted documents and certificates", async () => {
    fakeDb.queue("select", [
      trailRow(1, { documentDeletedAt: new Date() }),
      trailRow(2, {
        type: "certificate.deleted",
        documentId: null,
        certificateId: CERT_ID,
        certificateDeletedAt: new Date(),
        versionId: null,
      }),
    ])
    fakeDb.queue("select", [{ total: 2 }])

    const result = await traceHandler.list({ context, input: listInput() })

    expect(result.entries[0]?.document?.deleted).toBe(true)
    expect(result.entries[1]?.certificate?.deleted).toBe(true)
  })

  test("answers NOT_FOUND for another user's certificate", async () => {
    fakeDb.queue("query.certificates.findFirst", undefined)

    await expectErrorCode(
      traceHandler.list({
        context,
        input: listInput({ certificateId: CERT_ID }),
      }),
      "NOT_FOUND"
    )
    const [call] = fakeDb.calls("query.certificates.findFirst")
    expect(call && stepArgs(call, "findFirst")[0]).toEqual({
      where: { id: CERT_ID, userId: USER_ID },
    })
    expect(fakeDb.calls("select")).toEqual([])
  })

  test("accepts one of the caller's certificates, deleted ones included", async () => {
    fakeDb.queue(
      "query.certificates.findFirst",
      certificateRow({ id: CERT_ID, deletedAt: new Date() })
    )
    fakeDb.queue("select", [])
    fakeDb.queue("select", [{ total: 0 }])

    const result = await traceHandler.list({
      context,
      input: listInput({ certificateId: CERT_ID }),
    })

    expect(result).toEqual({ entries: [], total: 0, nextCursor: null })
  })

  test("rejects a malformed cursor", async () => {
    await expectErrorCode(
      traceHandler.list({
        context,
        input: listInput({ cursor: "not-a-cursor" }),
      }),
      "BAD_REQUEST"
    )
  })

  test("refuses a rename trace without its names", async () => {
    fakeDb.queue("select", [trailRow(1, { type: "document.renamed" })])
    fakeDb.queue("select", [{ total: 1 }])

    await expectErrorCode(
      traceHandler.list({ context, input: listInput() }),
      "INTERNAL_SERVER_ERROR"
    )
  })
})

describe("trace.list input", () => {
  test("rejects a type both included and excluded", () => {
    expect(
      traceInput.list.safeParse({
        types: ["document.signed"],
        excludedTypes: ["document.signed"],
      }).success
    ).toBe(false)
  })

  test("rejects an inverted or empty range", () => {
    expect(
      traceInput.list.safeParse({
        from: "2026-10-08T00:00:00.000Z",
        before: "2026-10-08T00:00:00.000Z",
      }).success
    ).toBe(false)
  })

  test("rejects an unknown type", () => {
    expect(
      traceInput.list.safeParse({ types: ["document.printed"] }).success
    ).toBe(false)
  })
})

describe("trace.certificates", () => {
  test("lists every certificate of the caller, deleted ones flagged", async () => {
    fakeDb.queue("select", [
      {
        id: CERT_ID,
        alias: "Personal",
        holder: certificate.commonName,
        deletedAt: new Date(),
      },
    ])

    const result = await traceHandler.certificates({ context })

    expect(result).toEqual([
      {
        id: CERT_ID,
        alias: "Personal",
        holder: certificate.commonName,
        deleted: true,
      },
    ])
  })
})
