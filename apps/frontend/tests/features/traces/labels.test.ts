import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test"
import {
  folderLabel,
  groupByRecency,
  TRAIL_TYPE_LABELS,
  traceDescription,
  traceSubject,
  traceTone,
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

describe("traceDescription", () => {
  test("shows both names of a rename", () => {
    expect(
      traceDescription({
        ...common,
        type: "document.renamed",
        details: { from: "borrador.pdf", to: "contrato.pdf" },
      })
    ).toBe("borrador.pdf → contrato.pdf")
  })

  test("shows the folders of a move, the root as Biblioteca", () => {
    expect(
      traceDescription({
        ...common,
        type: "document.moved",
        details: { from: { id: FOLDER_ID, name: "2025" }, to: null },
      })
    ).toBe("2025 → Biblioteca")
  })

  test("names the merged documents", () => {
    expect(
      traceDescription({
        ...common,
        type: "document.merged",
        details: {
          sources: [
            { id: DOC_ID, name: "a.pdf" },
            { id: CERT_ID, name: "b.pdf" },
          ],
        },
      })
    ).toBe("Unión de a.pdf y b.pdf")
  })

  test("names the version of a download and what a deletion keeps", () => {
    expect(
      traceDescription({
        ...common,
        type: "document.downloaded",
        details: null,
      })
    ).toBe("Descargada la versión 3")
    expect(
      traceDescription({
        ...common,
        type: "certificate.deleted",
        details: null,
        document: null,
        certificate,
        version: null,
      })
    ).toBe(
      "Se borraron el archivo y la contraseña; sus firmas siguen registradas"
    )
  })

  test("names the certificate, version and placement of a signature", () => {
    expect(
      traceDescription({
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
    ).toBe("Firmado con «FNMT personal» · v2 · Visible en páginas 1, 3")
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

describe("traceTone", () => {
  test("marks signatures and deletions", () => {
    expect(traceTone("document.signed")).toBe("primary")
    expect(traceTone("certificate.deleted")).toBe("destructive")
    expect(traceTone("document.downloaded")).toBe("muted")
  })
})

describe("groupByRecency", () => {
  beforeEach(() => setSystemTime(new Date("2026-10-09T12:00:00.000Z")))
  afterEach(() => setSystemTime())

  test("keeps the order and splits it into recency groups", () => {
    const entry = (id: string, occurredAt: string): TrailEntry => ({
      ...common,
      id,
      occurredAt,
      type: "document.uploaded",
      details: null,
    })
    const groups = groupByRecency([
      entry("a", "2026-10-09T10:00:00.000Z"),
      entry("b", "2026-10-08T10:00:00.000Z"),
      entry("c", "2026-10-07T10:00:00.000Z"),
      entry("d", "2026-09-20T10:00:00.000Z"),
    ])

    expect(
      groups.map((group) => [group.label, group.entries.map((item) => item.id)])
    ).toEqual([
      ["Hoy", ["a"]],
      ["Esta semana", ["b", "c"]],
      ["Este mes", ["d"]],
    ])
  })
})
