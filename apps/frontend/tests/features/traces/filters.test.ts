import { describe, expect, test } from "bun:test"
import {
  ALL_CERTIFICATES,
  activeTraceFilterCount,
  deletedAware,
  emptyTraceFilters,
  placementLabel,
  traceQueryInput,
} from "@/features/traces/overview/model/filters"

const CERT_ID = "00000000-0000-4000-8000-0000000000c1"

describe("traceQueryInput", () => {
  test("sends no filter when none is set", () => {
    expect(traceQueryInput(emptyTraceFilters)).toEqual({})
  })

  test("drops blank text and trims the rest", () => {
    expect(traceQueryInput({ ...emptyTraceFilters, query: "   " })).toEqual({})
    expect(
      traceQueryInput({
        ...emptyTraceFilters,
        query: "  contrato ",
      })
    ).toEqual({ query: "contrato" })
  })

  test("sends the certificate unless every certificate is chosen", () => {
    expect(
      traceQueryInput({
        ...emptyTraceFilters,
        certificateId: CERT_ID,
      })
    ).toEqual({ certificateId: CERT_ID })
    expect(
      traceQueryInput({
        ...emptyTraceFilters,
        certificateId: ALL_CERTIFICATES,
      })
    ).toEqual({})
  })

  test("sends included and excluded types, ignoring unknown ones", () => {
    expect(
      traceQueryInput({
        ...emptyTraceFilters,
        types: {
          include: ["document.signed", "document.printed"],
          exclude: ["certificate.deleted"],
        },
      })
    ).toEqual({
      types: ["document.signed"],
      excludedTypes: ["certificate.deleted"],
    })
  })

  test("covers a whole day when Desde and Hasta are the same day", () => {
    const day = new Date(2026, 9, 7, 15, 30)

    expect(
      traceQueryInput({
        ...emptyTraceFilters,
        from: day,
        to: day,
      })
    ).toEqual({
      from: "2026-10-07T00:00:00.000Z",
      before: "2026-10-08T00:00:00.000Z",
    })
  })

  test("keeps an open end when only one bound is set", () => {
    expect(
      traceQueryInput({
        ...emptyTraceFilters,
        from: new Date(2026, 9, 1),
      })
    ).toEqual({ from: "2026-10-01T00:00:00.000Z" })
    expect(
      traceQueryInput({
        ...emptyTraceFilters,
        to: new Date(2026, 9, 7),
      })
    ).toEqual({ before: "2026-10-08T00:00:00.000Z" })
  })

  test("orders days picked the wrong way round", () => {
    expect(
      traceQueryInput({
        ...emptyTraceFilters,
        from: new Date(2026, 9, 7),
        to: new Date(2026, 9, 1),
      })
    ).toEqual({
      from: "2026-10-01T00:00:00.000Z",
      before: "2026-10-08T00:00:00.000Z",
    })
  })
})

describe("activeTraceFilterCount", () => {
  test("counts each filter that narrows the log", () => {
    expect(activeTraceFilterCount(emptyTraceFilters)).toBe(0)
    expect(
      activeTraceFilterCount({
        query: "contrato",
        types: { include: [], exclude: ["document.downloaded"] },
        certificateId: CERT_ID,
        from: new Date(2026, 9, 1),
        to: undefined,
      })
    ).toBe(4)
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
