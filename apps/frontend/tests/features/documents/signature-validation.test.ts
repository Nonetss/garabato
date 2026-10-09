import { describe, expect, test } from "bun:test"
import {
  checkRows,
  checkTone,
  coverageSummary,
  type SignatureReport,
  signerName,
  verdictLabel,
  verdictTone,
} from "@/features/documents/detail/model/signature-validation"

function report(overrides: Partial<SignatureReport> = {}): SignatureReport {
  return {
    fieldName: "Signature1",
    subFilter: "ETSI.CAdES.detached",
    level: "B-B",
    claimedTime: "2026-10-09T10:00:00.000Z",
    reason: null,
    location: null,
    signer: null,
    timestamp: null,
    coverage: "whole",
    checks: null,
    verdict: "indeterminate",
    problem: null,
    modifiedAfterSigning: false,
    ...overrides,
  }
}

describe("signature validation labels", () => {
  test("every verdict has a Spanish label and a non-green tone", () => {
    expect(verdictLabel("valid")).toBe("Válida")
    expect(verdictLabel("valid_untrusted")).toBe("Válida, emisor no reconocido")
    expect(verdictLabel("invalid")).toBe("No válida")
    expect(verdictLabel("indeterminate")).toBe("No comprobable")
    expect(verdictTone("invalid")).toBe("destructive")
    expect(verdictTone("valid")).toBe("foreground")
  })

  test("a failed check is destructive", () => {
    expect(checkTone(true)).toBe("foreground")
    expect(checkTone(false)).toBe("destructive")
  })

  test("coverage reads as a one-line summary", () => {
    expect(coverageSummary("whole")).toBe("Cubre todo el documento")
    expect(coverageSummary("followed_by_changes")).toContain("cambios")
  })

  test("lists the five checks", () => {
    expect(checkRows.map((row) => row.key)).toEqual([
      "integrity",
      "signature",
      "coverage",
      "certificateValidity",
      "trust",
    ])
  })

  test("names the signer, then the field", () => {
    const signer = {
      holder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
      taxId: "12345678Z",
      issuer: "AC PRUEBAS",
      serialNumber: "01",
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: "2036-01-01T00:00:00.000Z",
    }
    expect(signerName(report({ signer }))).toBe(signer.holder)
    expect(signerName(report())).toBe("Signature1")
    expect(signerName(report({ fieldName: "" }))).toBe("Firma sin identificar")
  })
})
