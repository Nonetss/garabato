import { describe, expect, test } from "bun:test"
import {
  timestampDetail,
  timestampLine,
} from "@/features/documents/shared/public"
import { formatDateTime } from "@/lib/format"

const TIME = "2026-10-09T10:15:02.000Z"
const formatted = formatDateTime(TIME, {
  includeYear: true,
  includeSeconds: true,
})

describe("signature timestamp labels", () => {
  test("a B-B signature has no timestamp line", () => {
    expect(
      timestampLine({ timestampedAt: null, timestampAuthority: null })
    ).toBeNull()
    expect(
      timestampDetail({ timestampedAt: null, timestampAuthority: null })
    ).toBe("Sin sello de tiempo")
  })

  test("a B-T signature shows the TSA's time and name", () => {
    const record = { timestampedAt: TIME, timestampAuthority: "FreeTSA" }
    expect(timestampLine(record)).toBe(`Sello de tiempo: ${formatted}`)
    expect(timestampDetail(record)).toBe(`${formatted} · FreeTSA`)
  })

  test("a token without an authority name shows only the time", () => {
    expect(
      timestampDetail({ timestampedAt: TIME, timestampAuthority: null })
    ).toBe(formatted)
  })
})
