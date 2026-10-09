import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  type PDFObject,
  PDFString,
} from "@cantoo/pdf-lib"

/**
 * What the signed bytes are followed by: nothing (`whole`), only revisions
 * that add other signatures, or revisions that change something else.
 */
export type SignatureCoverage =
  | "whole"
  | "followed_by_signatures"
  | "followed_by_changes"

/** One signature as found in the file, before any cryptographic check. */
export type ExtractedSignature = {
  fieldName: string
  subFilter: string | null
  /** `/M`: the time the signer claims, not proven. */
  claimedTime: Date | null
  reason: string | null
  location: string | null
  /** `[start1, length1, start2, length2]`, or null when malformed. */
  byteRange: [number, number, number, number] | null
  /** The byte range starts at 0 and leaves out exactly `/Contents`. */
  byteRangeValid: boolean
  /** The CMS, with the placeholder's zero padding. */
  contents: Uint8Array<ArrayBuffer>
  /** The bytes the signature covers, sliced from the original file. */
  signedBytes: Uint8Array<ArrayBuffer>
  /** Where the signed bytes end in the file. */
  signedEnd: number
  coverage: SignatureCoverage
}

const EOF_MARKER = "%%EOF"
const LT = 0x3c
const GT = 0x3e
/** End-of-line bytes a writer may or may not put after `%%EOF`. */
const EOL_SLACK = 2

function textOf(value: PDFObject | undefined) {
  if (value instanceof PDFString || value instanceof PDFHexString) {
    return value.decodeText()
  }
  if (value instanceof PDFName) return value.decodeText()
  return null
}

function dateOf(value: PDFObject | undefined) {
  if (!(value instanceof PDFString || value instanceof PDFHexString)) {
    return null
  }
  try {
    return value.decodeDate()
  } catch {
    return null
  }
}

function bytesOf(value: PDFObject | undefined) {
  if (value instanceof PDFString || value instanceof PDFHexString) {
    return new Uint8Array(value.asBytes())
  }
  return new Uint8Array()
}

function byteRangeOf(
  value: PDFObject | undefined
): [number, number, number, number] | null {
  if (!(value instanceof PDFArray) || value.size() !== 4) return null
  const numbers = value
    .asArray()
    .filter((item) => item instanceof PDFNumber)
    .map((item) => item.asNumber())
  const [a, b, c, d] = numbers
  if (
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    !numbers.every((n) => Number.isInteger(n) && n >= 0)
  ) {
    return null
  }
  return [a, b, c, d]
}

function isHexDigit(byte: number) {
  return (
    (byte >= 0x30 && byte <= 0x39) ||
    (byte >= 0x41 && byte <= 0x46) ||
    (byte >= 0x61 && byte <= 0x66)
  )
}

/** `[0, b, c, d]` with the gap `b..c` being exactly `<hex digits>`. */
function isValidByteRange(
  pdf: Uint8Array,
  [a, b, c, d]: [number, number, number, number]
) {
  if (a !== 0 || b === 0 || c <= b + 1 || c + d > pdf.length) return false
  if (pdf[b] !== LT || pdf[c - 1] !== GT) return false
  return pdf.subarray(b + 1, c - 1).every(isHexDigit)
}

function signedBytesOf(
  pdf: Uint8Array,
  range: [number, number, number, number] | null
) {
  if (range === null) return new Uint8Array()
  const [a, b, c, d] = range
  const signed = new Uint8Array(b + d)
  signed.set(pdf.subarray(a, a + b), 0)
  signed.set(pdf.subarray(c, c + d), b)
  return signed
}

/** Offsets right after each `%%EOF` marker: where each revision ends. */
export function revisionEnds(pdf: Uint8Array): number[] {
  const text = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.length).toString(
    "latin1"
  )
  const ends: number[] = []
  for (
    let at = text.indexOf(EOF_MARKER);
    at !== -1;
    at = text.indexOf(EOF_MARKER, at + 1)
  ) {
    ends.push(at + EOF_MARKER.length)
  }
  return ends
}

function isWhitespaceTail(pdf: Uint8Array, from: number) {
  return pdf
    .subarray(from)
    .every((byte) => byte === 0x0a || byte === 0x0d || byte === 0x20)
}

function near(a: number, b: number) {
  return Math.abs(a - b) <= EOL_SLACK
}

/**
 * Classifies what follows each signature from the revision ends: a later
 * revision that ends where another signature's bytes end was appended by
 * that signature; any other later revision changed the document.
 */
export function coverageOf(
  pdf: Uint8Array,
  signedEnd: number,
  otherSignedEnds: number[],
  ends: number[]
): SignatureCoverage {
  if (isWhitespaceTail(pdf, signedEnd)) return "whole"
  const later = ends.filter((end) => end > signedEnd + EOL_SLACK)
  const bySignatures = later.every((end) =>
    otherSignedEnds.some((other) => near(other, end))
  )
  if (later.length > 0 && bySignatures) return "followed_by_signatures"
  return "followed_by_changes"
}

type FoundSignature = Omit<ExtractedSignature, "coverage">

function readSignature(
  pdf: Uint8Array,
  fieldName: string,
  value: PDFDict
): FoundSignature {
  const byteRange = byteRangeOf(value.lookup(PDFName.of("ByteRange")))
  const signedEnd = byteRange === null ? 0 : byteRange[2] + byteRange[3]
  return {
    fieldName,
    subFilter: textOf(value.lookup(PDFName.of("SubFilter"))),
    claimedTime: dateOf(value.lookup(PDFName.of("M"))),
    reason: textOf(value.lookup(PDFName.of("Reason"))),
    location: textOf(value.lookup(PDFName.of("Location"))),
    byteRange,
    byteRangeValid: byteRange !== null && isValidByteRange(pdf, byteRange),
    contents: bytesOf(value.lookup(PDFName.of("Contents"))),
    signedBytes: signedBytesOf(pdf, byteRange),
    signedEnd,
  }
}

/**
 * Finds every signature field holding a signature (`/FT /Sig` with a `/V`
 * dictionary, `Kids` included) and returns them in the order they were
 * added to the file, each with the bytes it covers and its coverage. Throws
 * when the file does not parse as a PDF.
 */
export async function extractSignatures(
  pdf: Uint8Array<ArrayBuffer>
): Promise<ExtractedSignature[]> {
  const doc = await PDFDocument.load(pdf, {
    ignoreEncryption: true,
    updateMetadata: false,
  })
  const form = doc.catalog.getAcroForm()
  if (!form) return []

  const found: FoundSignature[] = []
  for (const [field] of form.getAllFields()) {
    if (field.getInheritableAttribute(PDFName.of("FT")) !== PDFName.of("Sig")) {
      continue
    }
    const value = field.dict.lookup(PDFName.of("V"))
    if (!(value instanceof PDFDict)) continue
    found.push(readSignature(pdf, field.getFullyQualifiedName() ?? "", value))
  }
  found.sort((left, right) => left.signedEnd - right.signedEnd)

  const ends = revisionEnds(pdf)
  return found.map((signature) => ({
    ...signature,
    coverage: coverageOf(
      pdf,
      signature.signedEnd,
      found
        .filter((other) => other !== signature)
        .map((other) => other.signedEnd),
      ends
    ),
  }))
}
