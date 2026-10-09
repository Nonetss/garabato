import { describe, expect, test } from "bun:test"
import {
  folderLabel,
  TRAIL_TYPE_LABELS,
  traceSubject,
  traceSummary,
} from "@/features/traces/overview/model/labels"
import type { TrailEntry } from "@/features/traces/overview/model/types"

const DOC_ID = "00000000-0000-4000-8000-0000000000d1"
const CERT_ID = "00000000-0000-4000-8000-0000000000c1"
const FOLDER_ID = "00000000-0000-4000-8000-0000000000a1"

const common = {
  id: "00000000-0000-4000-8000-000000000001",
  occurredAt: "2026-10-07T12:00:00.000Z",
  ipAddress: null,
  document: { id: DOC_ID, name: "contrato.pdf", deleted: false },
  certificate: null,
  version: { id: "00000000-0000-4000-8000-0000000000e1", number: 3 },
}

const certificate = {
  id: CERT_ID,
  alias: "FNMT personal",
  holder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
  deleted: false,
}

describe("traceSubject", () => {
  test("names the document, marking it when deleted", () => {
    const entry: TrailEntry = {
      ...common,
      type: "document.deleted",
      details: null,
      document: { id: DOC_ID, name: "contrato.pdf", deleted: true },
    }
    expect(traceSubject(entry)).toBe("contrato.pdf (eliminado)")
  })

  test("names the certificate of certificate entries", () => {
    const entry: TrailEntry = {
      ...common,
      type: "certificate.imported",
      details: null,
      document: null,
      certificate,
      version: null,
    }
    expect(traceSubject(entry)).toBe("FNMT personal")
  })
})

describe("traceSummary", () => {
  test("shows both names of a rename", () => {
    expect(
      traceSummary({
        ...common,
        type: "document.renamed",
        details: { from: "borrador.pdf", to: "contrato.pdf" },
      })
    ).toBe("borrador.pdf → contrato.pdf")
  })

  test("shows the folders of a move, the root as Biblioteca", () => {
    expect(
      traceSummary({
        ...common,
        type: "document.moved",
        details: { from: { id: FOLDER_ID, name: "2025" }, to: null },
      })
    ).toBe("2025 → Biblioteca")
  })

  test("counts the merged documents", () => {
    expect(
      traceSummary({
        ...common,
        type: "document.merged",
        details: {
          sources: [
            { id: DOC_ID, name: "a.pdf" },
            { id: CERT_ID, name: "b.pdf" },
          ],
        },
      })
    ).toBe("2 documentos")
  })

  test("shows the version of a download and nothing without one", () => {
    expect(
      traceSummary({ ...common, type: "document.downloaded", details: null })
    ).toBe("v3")
    expect(
      traceSummary({
        ...common,
        type: "certificate.deleted",
        details: null,
        document: null,
        certificate,
        version: null,
      })
    ).toBe("")
  })

  test("shows the version and placement of a signature", () => {
    expect(
      traceSummary({
        ...common,
        type: "document.signed",
        details: null,
        certificate,
        signature: {
          id: common.id,
          documentId: DOC_ID,
          documentName: "contrato.pdf",
          documentDeleted: false,
          versionId: "00000000-0000-4000-8000-0000000000e2",
          versionNumber: 2,
          certificateId: CERT_ID,
          certificateAlias: certificate.alias,
          certificateHolder: certificate.holder,
          signedAt: common.occurredAt,
          visible: true,
          pages: [0, 2],
          rect: { x: 0.6, y: 0.8, width: 0.3, height: 0.1 },
          reason: null,
          location: null,
          sha256Before: "0".repeat(64),
          sha256After: "1".repeat(64),
          ipAddress: null,
          timestampedAt: null,
          timestampAuthority: null,
          certificateDeleted: false,
          certificateTaxId: "12345678Z",
          certificateIssuer: "AC PRUEBAS AUTOFIRMAS",
          certificateSerialNumber: "1DA4",
          certificateFingerprint: "7".repeat(64),
          certificateNotBefore: "2025-01-01T00:00:00.000Z",
          certificateNotAfter: "2027-01-01T00:00:00.000Z",
        },
      })
    ).toBe("v2 · Visible en páginas 1, 3")
  })
})

describe("labels", () => {
  test("names the root folder", () => {
    expect(folderLabel(null)).toBe("Biblioteca")
  })

  test("labels every type in Spanish", () => {
    expect(TRAIL_TYPE_LABELS["certificate.imported"]).toBe(
      "Certificado importado"
    )
    expect(TRAIL_TYPE_LABELS["document.signed"]).toBe("Documento firmado")
  })
})
