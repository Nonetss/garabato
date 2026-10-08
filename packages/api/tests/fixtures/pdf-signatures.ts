import { X509Certificate } from "node:crypto"
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
} from "@cantoo/pdf-lib"
import * as pkijs from "pkijs"

const OID_SIGNING_CERTIFICATE_V2 = "1.2.840.113549.1.9.16.2.47"
const BYTE_RANGE = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g

export type VerifiedSignature = {
  subFilter: string
  /** The digest matches the signed bytes and the CMS signature verifies. */
  intact: boolean
  /** The byte range reaches the end of the file. */
  coversWholeDocument: boolean
  /** Length of the revision this signature covers. */
  signedLength: number
  hasSigningCertificateV2: boolean
  signerSubject: string
}

async function verifyCms(
  signedData: pkijs.SignedData,
  data: Uint8Array
): Promise<{ intact: boolean; signer?: pkijs.Certificate | null }> {
  try {
    const result = await signedData.verify({
      signer: 0,
      data: new Uint8Array(data).buffer,
      extendedMode: true,
    })
    return {
      intact: result.signatureVerified === true,
      signer: result.signerCertificate,
    }
  } catch {
    return { intact: false }
  }
}

function sigDictAround(pdf: string, at: number) {
  const start = pdf.lastIndexOf("<<", at)
  return pdf.slice(start, pdf.indexOf("/Contents", start))
}

/**
 * Independent check of every signature in a PDF: extracts each byte range
 * and its CMS and verifies them with pkijs, the way a validator would.
 */
export async function verifySignatures(
  bytes: Uint8Array
): Promise<VerifiedSignature[]> {
  const latin1 = Buffer.from(bytes).toString("latin1")
  const results: VerifiedSignature[] = []
  for (const match of latin1.matchAll(BYTE_RANGE)) {
    const [a = 0, b = 0, c = 0, d = 0] = match.slice(1).map(Number)
    const dict = sigDictAround(latin1, match.index)
    const der = Buffer.from(latin1.slice(b + 1, c - 1), "hex")
    const signed = Buffer.concat([
      bytes.subarray(a, a + b),
      bytes.subarray(c, c + d),
    ])
    const contentInfo = pkijs.ContentInfo.fromBER(der)
    const signedData = new pkijs.SignedData({ schema: contentInfo.content })
    const verified = await verifyCms(signedData, signed)
    const attributes = signedData.signerInfos[0]?.signedAttrs?.attributes ?? []
    const signer = verified.signer
    results.push({
      subFilter: dict.match(/\/SubFilter\s*\/([\w.]+)/)?.[1] ?? "",
      intact: verified.intact,
      coversWholeDocument: c + d === bytes.length,
      signedLength: c + d,
      hasSigningCertificateV2: attributes.some(
        (attribute) => attribute.type === OID_SIGNING_CERTIFICATE_V2
      ),
      signerSubject: signer
        ? new X509Certificate(new Uint8Array(signer.toSchema().toBER())).subject
        : "",
    })
  }
  return results
}

export type WidgetInfo = {
  pageIndex: number
  rect: number[]
  matrix: number[]
}

function numbers(array: PDFArray | undefined) {
  if (!array) return []
  return array
    .asArray()
    .filter((value) => value instanceof PDFNumber)
    .map((value) => value.asNumber())
}

/** The widgets of the last signature field: page, /Rect and stamp /Matrix. */
export async function lastSignatureWidgets(
  bytes: Uint8Array
): Promise<WidgetInfo[]> {
  const doc = await PDFDocument.load(bytes)
  const lastRef = doc.catalog.getOrCreateAcroForm().getAllFields().at(-1)?.[1]
  if (!lastRef) return []
  const fieldDict = doc.context.lookupMaybe(lastRef, PDFDict)
  if (!fieldDict) return []
  const kids = fieldDict.lookupMaybe(PDFName.of("Kids"), PDFArray)
  const pageRefs = doc.getPages().map((page) => page.ref)
  const widgets: WidgetInfo[] = []
  for (const kid of kids?.asArray() ?? []) {
    if (!(kid instanceof PDFRef)) continue
    const widgetDict = doc.context.lookupMaybe(kid, PDFDict)
    if (!widgetDict) continue
    const pageRef = widgetDict.get(PDFName.of("P"))
    const ap = widgetDict.lookupMaybe(PDFName.of("AP"), PDFDict)
    const normal = ap?.lookup(PDFName.of("N"))
    const matrix =
      normal instanceof PDFRawStream
        ? numbers(normal.dict.lookupMaybe(PDFName.of("Matrix"), PDFArray))
        : []
    widgets.push({
      pageIndex: pageRefs.findIndex((ref) => ref === pageRef),
      rect: numbers(widgetDict.lookupMaybe(PDFName.of("Rect"), PDFArray)),
      matrix,
    })
  }
  return widgets
}
