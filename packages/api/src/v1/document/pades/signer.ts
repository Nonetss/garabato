import { Signer } from "@signpdf/utils"
import * as asn1js from "asn1js"
import * as pkijs from "pkijs"
import type { Timestamper, TimestampToken } from "#v1/document/pades/timestamp"

// pkijs finds Bun's WebCrypto on its own (`self.crypto`), so no engine is set.

const OID_DATA = "1.2.840.113549.1.7.1"
const OID_CONTENT_TYPE = "1.2.840.113549.1.9.3"
const OID_MESSAGE_DIGEST = "1.2.840.113549.1.9.4"
const OID_SIGNING_CERTIFICATE_V2 = "1.2.840.113549.1.9.16.2.47"
const OID_SIGNATURE_TIME_STAMP_TOKEN = "1.2.840.113549.1.9.16.2.14"

export type SignerIdentity = {
  privateKey: CryptoKey
  /** DER of the signer certificate. */
  certificate: Uint8Array<ArrayBuffer>
  /** DER of the issuer chain, embedded so validators can build the path. */
  chain: Uint8Array<ArrayBuffer>[]
}

// ESS signing-certificate-v2 binds the signature to the signer certificate.
// PAdES baseline (ETSI EN 319 142-1) requires it; it is what sets this apart
// from a plain adbe.pkcs7.detached signature.
async function signingCertificateV2(certificate: pkijs.Certificate) {
  const certHash = await crypto.subtle.digest(
    "SHA-256",
    certificate.toSchema().toBER()
  )
  const issuerSerial = new asn1js.Sequence({
    value: [
      new asn1js.Sequence({
        value: [
          new asn1js.Constructed({
            idBlock: { tagClass: 3, tagNumber: 4 },
            value: [certificate.issuer.toSchema()],
          }),
        ],
      }),
      certificate.serialNumber,
    ],
  })
  // hashAlgorithm is omitted because SHA-256 is its DEFAULT value.
  const essCertIdV2 = new asn1js.Sequence({
    value: [new asn1js.OctetString({ valueHex: certHash }), issuerSerial],
  })
  return new asn1js.Sequence({
    value: [new asn1js.Sequence({ value: [essCertIdV2] })],
  })
}

/**
 * Produces the detached CAdES signature of the PDF byte ranges that
 * SubFilter ETSI.CAdES.detached expects. The claimed signing time lives in
 * the signature dictionary's /M, so there is no CMS signing-time attribute.
 * With a `timestamper` the signature also carries an RFC 3161 token over its
 * signature value (PAdES B-T); without one it is B-B. The token used is kept
 * in `timestamp` for the signature record.
 */
export class PadesSigner extends Signer {
  private readonly identity: SignerIdentity
  private readonly timestamper: Timestamper | null
  timestamp: TimestampToken | null = null

  constructor(identity: SignerIdentity, timestamper: Timestamper | null) {
    super()
    this.identity = identity
    this.timestamper = timestamper
  }

  /** Adds the signature-time-stamp unsigned attribute (CAdES, B-T). */
  private async addTimestamp(
    signerInfo: pkijs.SignerInfo,
    timestamper: Timestamper
  ) {
    const timestamp = await timestamper(
      new Uint8Array(signerInfo.signature.valueBlock.valueHexView)
    )
    signerInfo.unsignedAttrs = new pkijs.SignedAndUnsignedAttributes({
      type: 1,
      attributes: [
        new pkijs.Attribute({
          type: OID_SIGNATURE_TIME_STAMP_TOKEN,
          values: [timestamp.token.toSchema()],
        }),
      ],
    })
    this.timestamp = timestamp
  }

  async sign(pdfBuffer: Buffer): Promise<Buffer> {
    const certificate = pkijs.Certificate.fromBER(this.identity.certificate)
    const chain = this.identity.chain.map((der) =>
      pkijs.Certificate.fromBER(der)
    )
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(pdfBuffer)
    )

    const signedData = new pkijs.SignedData({
      version: 1,
      encapContentInfo: new pkijs.EncapsulatedContentInfo({
        eContentType: OID_DATA,
      }),
      signerInfos: [
        new pkijs.SignerInfo({
          version: 1,
          sid: new pkijs.IssuerAndSerialNumber({
            issuer: certificate.issuer,
            serialNumber: certificate.serialNumber,
          }),
          signedAttrs: new pkijs.SignedAndUnsignedAttributes({
            type: 0,
            attributes: [
              new pkijs.Attribute({
                type: OID_CONTENT_TYPE,
                values: [new asn1js.ObjectIdentifier({ value: OID_DATA })],
              }),
              new pkijs.Attribute({
                type: OID_MESSAGE_DIGEST,
                values: [new asn1js.OctetString({ valueHex: digest })],
              }),
              new pkijs.Attribute({
                type: OID_SIGNING_CERTIFICATE_V2,
                values: [await signingCertificateV2(certificate)],
              }),
            ],
          }),
        }),
      ],
      certificates: [certificate, ...chain],
    })

    await signedData.sign(this.identity.privateKey, 0, "SHA-256")
    const signerInfo = signedData.signerInfos[0]
    if (this.timestamper && signerInfo) {
      await this.addTimestamp(signerInfo, this.timestamper)
    }

    const contentInfo = new pkijs.ContentInfo({
      contentType: pkijs.ContentInfo.SIGNED_DATA,
      content: signedData.toSchema(true),
    })
    return Buffer.from(contentInfo.toSchema().toBER())
  }
}
