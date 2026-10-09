import { describe, expect, test } from "bun:test"
import { degrees, PDFDocument } from "@cantoo/pdf-lib"
import { openSigningKey } from "#shared/pkcs12"
import { P12_PASSWORD, p12Fixture } from "#tests/fixtures/certificate-files"
import { type PdfFixture, pdfFixture } from "#tests/fixtures/document-files"
import {
  lastSignatureWidgets,
  signatureAttributes,
} from "#tests/fixtures/pdf-signatures"
import { createFakeTsa, FAKE_TSA_TIME } from "#tests/fixtures/tsa"
import type { VisibleAppearance } from "#v1/document/pades/appearance"
import {
  AppearanceError,
  EncryptedPdfError,
  type SignPdfOptions,
  signPdf,
} from "#v1/document/pades/sign"
import { TimestampError } from "#v1/document/pades/timestamp"
import { validateSignatures } from "#v1/document/validation/verify"

const A4 = { width: 595.28, height: 841.89 }
const RECT = { x: 0.1, y: 0.2, width: 0.3, height: 0.1 }

async function options(
  certificate: "rsa" | "ec",
  appearance?: VisibleAppearance
): Promise<SignPdfOptions> {
  const identity = await openSigningKey(
    await p12Fixture(certificate),
    P12_PASSWORD
  )
  return {
    identity,
    signerName: identity.metadata.commonName,
    signingTime: new Date("2026-10-08T10:00:00.000Z"),
    reason: "Conformidad",
    location: "Madrid",
    appearance,
    timestamper: null,
  }
}

async function withRotation(name: PdfFixture, page: number, angle: number) {
  const doc = await PDFDocument.load(await pdfFixture(name))
  doc.getPage(page).setRotation(degrees(angle))
  return new Uint8Array(await doc.save())
}

function expectRect(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(4)
  for (const [index, value] of expected.entries()) {
    expect(actual[index]).toBeCloseTo(value, 2)
  }
}

describe("signPdf timestamps", () => {
  test("a B-B signature has no unsigned attributes and no token", async () => {
    const signed = await signPdf(
      await pdfFixture("plain"),
      await options("rsa")
    )

    const [attributes] = await signatureAttributes(signed.bytes)
    expect(attributes?.unsignedAttributeTypes).toEqual([])
    expect(signed.timestamp).toBeNull()
  })

  test("a B-T signature carries a token over its signature value", async () => {
    const tsa = createFakeTsa()
    const signed = await signPdf(await pdfFixture("plain"), {
      ...(await options("rsa")),
      timestamper: tsa.timestamper,
    })

    const { signatures } = await validateSignatures(signed.bytes)
    expect(signatures[0]?.checks?.integrity.passed).toBe(true)
    expect(signatures[0]?.checks?.signature.passed).toBe(true)
    expect(signatures[0]?.level).toBe("B-T")
    const [attributes] = await signatureAttributes(signed.bytes)
    expect(attributes?.unsignedAttributeTypes).toEqual([
      "1.2.840.113549.1.9.16.2.14",
    ])
    expect(attributes?.timestampImprint).toEqual(
      attributes?.signatureValueDigest
    )
    expect(signed.timestamp?.time).toEqual(FAKE_TSA_TIME)
  })

  test("a failing TSA stops the signature", async () => {
    const tsa = createFakeTsa()
    tsa.setMode("unreachable")
    const error = await signPdf(await pdfFixture("plain"), {
      ...(await options("rsa")),
      timestamper: tsa.timestamper,
    }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(TimestampError)
  })
})

describe("signPdf", () => {
  test("adds a valid PAdES B-B signature as an incremental update", async () => {
    const original = await pdfFixture("plain")
    const signed = await signPdf(original, await options("rsa"))

    const { signatures } = await validateSignatures(signed.bytes)
    const [signature] = signatures
    expect(signature).toMatchObject({
      subFilter: "ETSI.CAdES.detached",
      level: "B-B",
      coverage: "whole",
    })
    expect(signature?.checks?.integrity.passed).toBe(true)
    expect(signature?.checks?.signature.passed).toBe(true)
    expect(signature?.signer?.taxId).toBe("12345678Z")
    const [attributes] = await signatureAttributes(signed.bytes)
    expect(attributes?.hasSigningCertificateV2).toBe(true)
    expect(signed.bytes.subarray(0, original.length)).toEqual(original)
    expect(signed.pages).toEqual([])
  })

  test("signs with an EC key", async () => {
    const signed = await signPdf(
      await pdfFixture("rotated"),
      await options("ec", { page: 0, pages: "one", rect: RECT })
    )

    const { signatures } = await validateSignatures(signed.bytes)
    expect(signatures[0]?.checks?.signature.passed).toBe(true)
    expect(signed.pages).toEqual([0])
  })

  test("keeps the first signature valid when signing again", async () => {
    const first = await signPdf(await pdfFixture("plain"), await options("rsa"))
    const second = await signPdf(
      first.bytes,
      await options("ec", { page: 2, pages: "one", rect: RECT })
    )

    const { signatures } = await validateSignatures(second.bytes)
    expect(
      signatures.map((signature) => signature.checks?.signature.passed)
    ).toEqual([true, true])
    expect(signatures.map((signature) => signature.coverage)).toEqual([
      "followed_by_signatures",
      "whole",
    ])
  })

  test("stamps every page with one signature", async () => {
    const signed = await signPdf(
      await pdfFixture("plain"),
      await options("rsa", { page: 0, pages: "all", rect: RECT })
    )

    expect((await validateSignatures(signed.bytes)).signatures).toHaveLength(1)
    const widgets = await lastSignatureWidgets(signed.bytes)
    expect(widgets.map((widget) => widget.pageIndex)).toEqual([0, 1, 2])
    expect(signed.pages).toEqual([0, 1, 2])
  })

  test("places the stamp on an unrotated page from the top-left", async () => {
    const signed = await signPdf(
      await pdfFixture("plain"),
      await options("rsa", { page: 0, pages: "one", rect: RECT })
    )

    const [widget] = await lastSignatureWidgets(signed.bytes)
    expectRect(widget?.rect ?? [], [
      0.1 * A4.width,
      0.7 * A4.height,
      0.4 * A4.width,
      0.8 * A4.height,
    ])
    expect(widget?.matrix).toEqual([1, 0, 0, 1, 0, 0])
  })

  test("counters a 90° page rotation", async () => {
    const signed = await signPdf(
      await pdfFixture("rotated"),
      await options("rsa", { page: 1, pages: "one", rect: RECT })
    )

    const [widget] = await lastSignatureWidgets(signed.bytes)
    expect(widget?.pageIndex).toBe(1)
    expectRect(widget?.rect ?? [], [
      0.2 * A4.width,
      0.1 * A4.height,
      0.3 * A4.width,
      0.4 * A4.height,
    ])
    expect(widget?.matrix).toEqual([0, 1, -1, 0, 0, 0])
  })

  test("counters a 270° page rotation", async () => {
    const signed = await signPdf(
      await withRotation("plain", 0, 270),
      await options("rsa", { page: 0, pages: "one", rect: RECT })
    )

    const [widget] = await lastSignatureWidgets(signed.bytes)
    expectRect(widget?.rect ?? [], [
      0.7 * A4.width,
      0.6 * A4.height,
      0.8 * A4.width,
      0.9 * A4.height,
    ])
    expect(widget?.matrix).toEqual([0, -1, 1, 0, 0, 0])
  })

  test("measures from the crop box, not the media box", async () => {
    const signed = await signPdf(
      await pdfFixture("cropped"),
      await options("rsa", { page: 0, pages: "one", rect: RECT })
    )

    const [widget] = await lastSignatureWidgets(signed.bytes)
    // Crop box: x 50, y 100, 400 × 600.
    expectRect(widget?.rect ?? [], [90, 520, 210, 580])
  })

  test("uses each page's own size when stamping every page", async () => {
    const signed = await signPdf(
      await pdfFixture("mixed-sizes"),
      await options("rsa", { page: 0, pages: "all", rect: RECT })
    )

    const [a4, a5] = await lastSignatureWidgets(signed.bytes)
    expect(a4?.rect[0]).toBeCloseTo(0.1 * 595.28, 2)
    expect(a5?.rect[0]).toBeCloseTo(0.1 * 419.53, 2)
  })

  test.each([
    ["outside the page", { page: 0, rect: { ...RECT, x: 0.9 } }],
    ["without area", { page: 0, rect: { ...RECT, height: 0 } }],
    ["on a missing page", { page: 7, rect: RECT }],
    ["negative", { page: 0, rect: { ...RECT, y: -0.1 } }],
  ])("rejects a rectangle %s", async (_, appearance) => {
    const error = await signPdf(
      await pdfFixture("plain"),
      await options("rsa", { ...appearance, pages: "one" })
    ).then(
      () => undefined,
      (thrown: unknown) => thrown
    )

    expect(error).toBeInstanceOf(AppearanceError)
  })

  test("refuses an encrypted PDF", async () => {
    const error = await signPdf(
      await pdfFixture("encrypted"),
      await options("rsa")
    ).then(
      () => undefined,
      (thrown: unknown) => thrown
    )

    expect(error).toBeInstanceOf(EncryptedPdfError)
  })
})
