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
import { extractSignatures } from "#v1/document/validation/extract"

const OID_SIGNING_CERTIFICATE_V2 = "1.2.840.113549.1.9.16.2.47"
const OID_SIGNATURE_TIME_STAMP_TOKEN = "1.2.840.113549.1.9.16.2.14"

/**
 * CMS attributes `validateSignatures` does not report, for the PAdES tests:
 * whether signing-certificate-v2 is signed, which unsigned attributes are
 * present, and what a B-T token's imprint is over. Intactness, coverage and
 * the signer come from `validateSignatures`.
 */
export type SignatureAttributes = {
  hasSigningCertificateV2: boolean
  /** OIDs of the SignerInfo's unsigned attributes (the B-T token's, if any). */
  unsignedAttributeTypes: string[]
  /** SHA-256 the embedded timestamp token is over; null without a token. */
  timestampImprint: Uint8Array | null
  /** SHA-256 of the SignerInfo's signature value, what a B-T token covers. */
  signatureValueDigest: Uint8Array
}

/** The message imprint of the signature-time-stamp token, if present. */
function timestampImprintOf(signerInfo: pkijs.SignerInfo | undefined) {
  const attribute = signerInfo?.unsignedAttrs?.attributes.find(
    (entry) => entry.type === OID_SIGNATURE_TIME_STAMP_TOKEN
  )
  const value = attribute?.values[0]
  if (!value) return null
  const token = new pkijs.ContentInfo({ schema: value })
  const tokenData = new pkijs.SignedData({ schema: token.content })
  const eContent = tokenData.encapContentInfo.eContent
  if (!eContent) return null
  const tstInfo = pkijs.TSTInfo.fromBER(eContent.getValue())
  return new Uint8Array(
    tstInfo.messageImprint.hashedMessage.valueBlock.valueHexView
  )
}

/** The CMS attributes of every signature in `pdf`, in signing order. */
export async function signatureAttributes(
  pdf: Uint8Array<ArrayBuffer>
): Promise<SignatureAttributes[]> {
  const results: SignatureAttributes[] = []
  for (const signature of await extractSignatures(pdf)) {
    const contentInfo = pkijs.ContentInfo.fromBER(signature.contents)
    const signedData = new pkijs.SignedData({ schema: contentInfo.content })
    const signerInfo = signedData.signerInfos[0]
    const signatureValue = new Uint8Array(
      signerInfo?.signature.valueBlock.valueHexView ?? []
    )
    results.push({
      hasSigningCertificateV2: (signerInfo?.signedAttrs?.attributes ?? []).some(
        (attribute) => attribute.type === OID_SIGNING_CERTIFICATE_V2
      ),
      unsignedAttributeTypes:
        signerInfo?.unsignedAttrs?.attributes.map((entry) => entry.type) ?? [],
      timestampImprint: timestampImprintOf(signerInfo),
      signatureValueDigest: new Uint8Array(
        await crypto.subtle.digest("SHA-256", signatureValue)
      ),
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
