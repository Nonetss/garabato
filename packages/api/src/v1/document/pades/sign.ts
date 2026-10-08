import { SignPdf } from "@signpdf/signpdf"
import {
  stampContent,
  type VisibleAppearance,
} from "#v1/document/pades/appearance"
import { addPlaceholder } from "#v1/document/pades/placeholder"
import { PadesSigner, type SignerIdentity } from "#v1/document/pades/signer"

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
}

/**
 * Signs a PDF with a PAdES B-B signature appended as an incremental update.
 * Returns the signed bytes and the 0-based pages showing the stamp.
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
  const signed = await signpdf.sign(
    placeholder.bytes,
    new PadesSigner(options.identity)
  )
  return { bytes: new Uint8Array(signed), pages: placeholder.pages }
}

export { AppearanceError } from "#v1/document/pades/appearance"
export { EncryptedPdfError } from "#v1/document/pades/placeholder"
