import { describe, expect, test } from "bun:test"
import {
  ALL_CERTIFICATES,
  activeSignatureLogFilterCount,
  deletedAware,
  emptySignatureLogFilters,
  placementLabel,
  signatureLogQueryInput,
} from "@/features/signatures/overview/model/filters"

const CERT_ID = "00000000-0000-4000-8000-0000000000c1"

describe("signatureLogQueryInput", () => {
  test("sends no filter when none is set", () => {
    expect(signatureLogQueryInput(emptySignatureLogFilters)).toEqual({})
  })

  test("drops blank text and trims the rest", () => {
    expect(
      signatureLogQueryInput({ ...emptySignatureLogFilters, query: "   " })
    ).toEqual({})
    expect(
      signatureLogQueryInput({
        ...emptySignatureLogFilters,
        query: "  contrato ",
      })
    ).toEqual({ query: "contrato" })
  })

  test("sends the certificate unless every certificate is chosen", () => {
    expect(
      signatureLogQueryInput({
        ...emptySignatureLogFilters,
        certificateId: CERT_ID,
      })
    ).toEqual({ certificateId: CERT_ID })
    expect(
      signatureLogQueryInput({
        ...emptySignatureLogFilters,
        certificateId: ALL_CERTIFICATES,
      })
    ).toEqual({})
  })

  test("covers a whole day when Desde and Hasta are the same day", () => {
    const day = new Date(2026, 9, 7, 15, 30)

    expect(
      signatureLogQueryInput({
        ...emptySignatureLogFilters,
        from: day,
        to: day,
      })
    ).toEqual({
      signedFrom: "2026-10-07T00:00:00.000Z",
      signedBefore: "2026-10-08T00:00:00.000Z",
    })
  })

  test("keeps an open end when only one bound is set", () => {
    expect(
      signatureLogQueryInput({
        ...emptySignatureLogFilters,
        from: new Date(2026, 9, 1),
      })
    ).toEqual({ signedFrom: "2026-10-01T00:00:00.000Z" })
    expect(
      signatureLogQueryInput({
        ...emptySignatureLogFilters,
        to: new Date(2026, 9, 7),
      })
    ).toEqual({ signedBefore: "2026-10-08T00:00:00.000Z" })
  })

  test("orders days picked the wrong way round", () => {
    expect(
      signatureLogQueryInput({
        ...emptySignatureLogFilters,
        from: new Date(2026, 9, 7),
        to: new Date(2026, 9, 1),
      })
    ).toEqual({
      signedFrom: "2026-10-01T00:00:00.000Z",
      signedBefore: "2026-10-08T00:00:00.000Z",
    })
  })
})

describe("activeSignatureLogFilterCount", () => {
  test("counts each filter that narrows the log", () => {
    expect(activeSignatureLogFilterCount(emptySignatureLogFilters)).toBe(0)
    expect(
      activeSignatureLogFilterCount({
        query: "contrato",
        certificateId: CERT_ID,
        from: new Date(2026, 9, 1),
        to: undefined,
      })
    ).toBe(3)
  })
})

describe("placementLabel", () => {
  test("names invisible signatures and the stamped pages, from 1", () => {
    expect(placementLabel({ visible: false, pages: [] })).toBe(
      "Firma invisible"
    )
    expect(placementLabel({ visible: true, pages: [1] })).toBe(
      "Visible en página 2"
    )
    expect(placementLabel({ visible: true, pages: [2, 0] })).toBe(
      "Visible en páginas 1, 3"
    )
  })
})

describe("deletedAware", () => {
  test("marks deleted names only", () => {
    expect(deletedAware("contrato.pdf", false)).toBe("contrato.pdf")
    expect(deletedAware("contrato.pdf", true)).toBe("contrato.pdf (eliminado)")
  })
})
