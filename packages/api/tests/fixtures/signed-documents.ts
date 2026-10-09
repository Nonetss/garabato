import { PDFDocument } from "@cantoo/pdf-lib"
import { openSigningKey } from "#shared/pkcs12"
import { P12_PASSWORD, p12Fixture } from "#tests/fixtures/certificate-files"
import { pdfFixture } from "#tests/fixtures/document-files"
import { signPdf } from "#v1/document/pades/sign"
import type { Timestamper } from "#v1/document/pades/timestamp"

function sourcePdf(pdf: Uint8Array<ArrayBuffer> | undefined) {
  if (pdf) return pdf
  return pdfFixture("plain")
}

/** Signs `pdf` (the `plain` fixture by default) invisibly with a fixture. */
export async function signedPdf({
  pdf,
  certificate = "rsa",
  signingTime = new Date(),
  timestamper = null,
}: {
  pdf?: Uint8Array<ArrayBuffer>
  certificate?: "rsa" | "ec"
  signingTime?: Date
  timestamper?: Timestamper | null
} = {}): Promise<Uint8Array<ArrayBuffer>> {
  const identity = await openSigningKey(
    await p12Fixture(certificate),
    P12_PASSWORD
  )
  const signed = await signPdf(await sourcePdf(pdf), {
    identity,
    signerName: identity.metadata.commonName,
    signingTime,
    reason: "Conformidad",
    location: "Madrid",
    timestamper,
  })
  return new Uint8Array(signed.bytes)
}

/**
 * Appends an incremental update that changes page content, the way an
 * editor saving over a signed PDF would.
 */
export async function withContentChange(
  pdf: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.load(pdf, { forIncrementalUpdate: true })
  const snapshot = doc.takeSnapshot()
  const page = doc.getPage(0)
  page.drawText("Cambio posterior a la firma", { x: 40, y: 40, size: 10 })
  snapshot.markRefForSave(page.ref)
  const update = await doc.saveIncremental(snapshot, {
    useObjectStreams: false,
  })
  const changed = new Uint8Array(pdf.length + update.length)
  changed.set(pdf, 0)
  changed.set(update, pdf.length)
  return changed
}
