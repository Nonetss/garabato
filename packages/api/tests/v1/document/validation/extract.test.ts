import { describe, expect, test } from "bun:test"
import { pdfFixture } from "#tests/fixtures/document-files"
import { signedPdf, withContentChange } from "#tests/fixtures/signed-documents"
import { extractSignatures } from "#v1/document/validation/extract"

describe("extractSignatures", () => {
  test("finds nothing in an unsigned PDF", async () => {
    expect(await extractSignatures(await pdfFixture("plain"))).toEqual([])
  })

  test("reads one signature covering the whole file", async () => {
    const signingTime = new Date("2026-10-08T10:00:00.000Z")
    const pdf = await signedPdf({ signingTime })

    const [signature, ...rest] = await extractSignatures(pdf)
    expect(rest).toEqual([])
    expect(signature).toMatchObject({
      subFilter: "ETSI.CAdES.detached",
      claimedTime: signingTime,
      reason: "Conformidad",
      location: "Madrid",
      byteRangeValid: true,
      coverage: "whole",
      signedEnd: pdf.length,
    })
    expect(signature?.contents.length).toBeGreaterThan(0)
    const [, b = 0, c = 0, d = 0] = signature?.byteRange ?? []
    expect(signature?.signedBytes.length).toBe(b + d)
    expect(c + d).toBe(pdf.length)
  })

  test("orders two signatures and sees the first followed only by a signature", async () => {
    const once = await signedPdf()
    const twice = await signedPdf({ pdf: once, certificate: "ec" })

    const signatures = await extractSignatures(twice)
    expect(signatures.map((signature) => signature.signedEnd)).toEqual([
      once.length,
      twice.length,
    ])
    expect(signatures.map((signature) => signature.coverage)).toEqual([
      "followed_by_signatures",
      "whole",
    ])
  })

  test("sees a signature followed by a content change", async () => {
    const changed = await withContentChange(await signedPdf())

    const [signature] = await extractSignatures(changed)
    expect(signature?.coverage).toBe("followed_by_changes")
    expect(signature?.byteRangeValid).toBe(true)
  })

  test("rejects a file that is not a PDF", async () => {
    await expect(
      extractSignatures(await pdfFixture("not-a-pdf"))
    ).rejects.toThrow()
  })
})
