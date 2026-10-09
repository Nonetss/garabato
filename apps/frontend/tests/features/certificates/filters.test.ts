import { describe, expect, test } from "bun:test"
import { filterCertificates } from "@/features/certificates/overview/model/filters"
import type { Certificate } from "@/features/certificates/overview/model/types"

function certificate(overrides: Partial<Certificate>): Certificate {
  return {
    id: "cert-1",
    alias: "Personal",
    commonName: "GARCÍA LÓPEZ MARÍA - 12345678Z",
    givenName: "MARÍA",
    surname: "GARCÍA LÓPEZ",
    taxId: "12345678Z",
    issuerCommonName: "AC FNMT Usuarios",
    serialNumber: "0a1b2c",
    fingerprintSha256: "ff".repeat(32),
    keyAlgorithm: "RSA",
    notBefore: "2025-01-01T00:00:00.000Z",
    notAfter: "2029-01-01T00:00:00.000Z",
    status: "valid",
    passwordRemembered: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const personal = certificate({})
const company = certificate({
  id: "cert-2",
  alias: "Empresa Señales",
  commonName: "SEÑALES SL",
  givenName: null,
  surname: null,
  taxId: null,
  issuerCommonName: "Camerfirma",
})
const certificates = [personal, company]

describe("filterCertificates", () => {
  test("keeps every certificate for a blank query", () => {
    expect(filterCertificates(certificates, "   ")).toEqual(certificates)
  })

  test("matches the alias ignoring case and accents", () => {
    expect(filterCertificates(certificates, "senales")).toEqual([company])
  })

  test("matches the holder, the NIF/NIE and the issuer", () => {
    expect(filterCertificates(certificates, "maria garcia")).toEqual([personal])
    expect(filterCertificates(certificates, "12345678z")).toEqual([personal])
    expect(filterCertificates(certificates, "camerfirma")).toEqual([company])
  })

  test("returns nothing when no certificate matches", () => {
    expect(filterCertificates(certificates, "inexistente")).toEqual([])
  })
})
