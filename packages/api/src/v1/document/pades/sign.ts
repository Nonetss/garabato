import { SignPdf } from "@signpdf/signpdf"
import {
  stampContent,
  type VisibleAppearance,
} from "#v1/document/pades/appearance"
import { addPlaceholder } from "#v1/document/pades/placeholder"
import { PadesSigner, type SignerIdentity } from "#v1/document/pades/signer"
import type { Timestamper } from "#v1/document/pades/timestamp"

// The named class, not the default instance: the backend bundle imports this
// CommonJS package in Node interop mode, where `default` is the whole
// `module.exports` and `default.sign` is undefined.
const signpdf = new SignPdf()

export type SignPdfOptions = {
  identity: SignerIdentity
  signerName: string
  signingTime: Date
  reason?: string
  location?: string
  /** Omit for an invisible signature. */
  appearance?: VisibleAppearance
  /** The TSA for a B-T signature; null signs B-B. */
  timestamper: Timestamper | null
}

/**
 * Signs a PDF with a PAdES signature appended as an incremental update: B-T
 * with a `timestamper`, B-B without. Returns the signed bytes, the 0-based
 * pages showing the stamp and the timestamp token used (null for B-B).
 */
export async function signPdf(pdf: Uint8Array, options: SignPdfOptions) {
  const placeholder = await addPlaceholder(pdf, {
    signerName: options.signerName,
    reason: options.reason,
    location: options.location,
    signingTime: options.signingTime,
    appearance: options.appearance,
    content: stampContent(options),
  })
  const signer = new PadesSigner(options.identity, options.timestamper)
  const signed = await signpdf.sign(placeholder.bytes, signer)
  return {
    bytes: new Uint8Array(signed),
    pages: placeholder.pages,
    timestamp: signer.timestamp,
  }
}

export { AppearanceError } from "#v1/document/pades/appearance"
export { EncryptedPdfError } from "#v1/document/pades/placeholder"
