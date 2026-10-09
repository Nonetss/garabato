import * as asn1js from "asn1js"
import * as pkijs from "pkijs"

const OID_SHA256 = "2.16.840.1.101.3.4.2.1"
const OID_COMMON_NAME = "2.5.4.3"
const NONCE_BYTES = 8
const PKI_STATUS_GRANTED = 0
const PKI_STATUS_GRANTED_WITH_MODS = 1
const GENERAL_NAME_DIRECTORY = 4

export const TIMESTAMP_TIMEOUT_MS = 10_000

/**
 * Why a timestamp could not be obtained: the TSA did not answer in time or
 * at all (`unreachable`), answered an HTTP error (`http`), refused the
 * request (`rejected`), or returned a token that does not match the request
 * or does not verify (`mismatch`).
 */
export type TimestampErrorKind =
  | "unreachable"
  | "http"
  | "rejected"
  | "mismatch"

export class TimestampError extends Error {
  readonly kind: TimestampErrorKind

  constructor(kind: TimestampErrorKind, message: string, cause?: unknown) {
    super(message, { cause })
    this.kind = kind
  }
}

/** A checked RFC 3161 token, ready to embed as an unsigned attribute. */
export type TimestampToken = {
  token: pkijs.ContentInfo
  /** `genTime`: when the TSA asserts it saw the digest. */
  time: Date
  /** The TSA's name, for the signature record. */
  authority: string
}

/** Gets a timestamp token over the SHA-256 of `data` (the signature value). */
export type Timestamper = (
  data: Uint8Array<ArrayBuffer>
) => Promise<TimestampToken>

/** The slice of `fetch` the client uses, so tests can pass a fake TSA. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export type TimestampRequestOptions = {
  fetch?: FetchLike
  timeoutMs?: number
}

/** A positive, minimally encoded random nonce: first byte in 0x01–0x7f. */
function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  bytes[0] = ((bytes[0] ?? 1) & 0x7f) | 0x01
  return bytes
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((byte, index) => byte === b[index])
}

function commonNameOf(name: pkijs.RelativeDistinguishedNames) {
  const attribute = name.typesAndValues.find(
    (entry) => entry.type === OID_COMMON_NAME
  )
  if (!attribute) return null
  const value = attribute.value.valueBlock.value
  if (typeof value !== "string" || value === "") return null
  return value
}

/** The TSA certificate's CN, then the token's `tsa` name, then the host. */
function authorityOf(
  signer: pkijs.Certificate | null | undefined,
  tstInfo: pkijs.TSTInfo,
  url: string
) {
  if (signer) {
    const name = commonNameOf(signer.subject)
    if (name) return name
  }
  if (
    tstInfo.tsa?.type === GENERAL_NAME_DIRECTORY &&
    tstInfo.tsa.value instanceof pkijs.RelativeDistinguishedNames
  ) {
    const name = commonNameOf(tstInfo.tsa.value)
    if (name) return name
  }
  return new URL(url).host
}

async function post(
  url: string,
  body: ArrayBuffer,
  {
    fetch: fetchImpl = fetch,
    timeoutMs = TIMESTAMP_TIMEOUT_MS,
  }: TimestampRequestOptions
) {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/timestamp-query" },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new TimestampError("unreachable", "TSA did not answer", error)
  }
  if (!response.ok) {
    throw new TimestampError("http", `TSA answered HTTP ${response.status}`)
  }
  try {
    return await response.arrayBuffer()
  } catch (error) {
    throw new TimestampError("unreachable", "TSA answer was cut off", error)
  }
}

function parseResponse(der: ArrayBuffer) {
  try {
    return pkijs.TimeStampResp.fromBER(der)
  } catch (error) {
    throw new TimestampError(
      "mismatch",
      "TSA answer is not a TimeStampResp",
      error
    )
  }
}

function tstInfoOf(signedData: pkijs.SignedData) {
  const eContent = signedData.encapContentInfo.eContent
  if (!eContent) {
    throw new TimestampError("mismatch", "Timestamp token has no TSTInfo")
  }
  try {
    return pkijs.TSTInfo.fromBER(eContent.getValue())
  } catch (error) {
    throw new TimestampError(
      "mismatch",
      "Timestamp token has no TSTInfo",
      error
    )
  }
}

async function verifiedSigner(
  signedData: pkijs.SignedData,
  data: Uint8Array<ArrayBuffer>
) {
  try {
    // For a TSTInfo, pkijs also re-hashes `data` against the imprint.
    const result = await signedData.verify({
      signer: 0,
      data: data.buffer,
      checkChain: false,
      extendedMode: true,
    })
    if (result.signatureVerified !== true) {
      throw new TimestampError("mismatch", "Timestamp token does not verify")
    }
    return result.signerCertificate
  } catch (error) {
    if (error instanceof TimestampError) throw error
    throw new TimestampError(
      "mismatch",
      "Timestamp token does not verify",
      error
    )
  }
}

/**
 * Asks an RFC 3161 TSA for a token over the SHA-256 of `data` and checks it
 * before returning: granted status, the same message imprint and nonce as
 * the request, and a token signature that verifies with the certificate it
 * carries (requested with `certReq`). Throws a `TimestampError` otherwise.
 */
export async function requestTimestamp(
  url: string,
  data: Uint8Array<ArrayBuffer>,
  options: TimestampRequestOptions = {}
): Promise<TimestampToken> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data))
  const nonce = randomNonce()
  const request = new pkijs.TimeStampReq({
    version: 1,
    messageImprint: new pkijs.MessageImprint({
      hashAlgorithm: new pkijs.AlgorithmIdentifier({
        algorithmId: OID_SHA256,
      }),
      hashedMessage: new asn1js.OctetString({ valueHex: digest }),
    }),
    nonce: new asn1js.Integer({ valueHex: nonce }),
    certReq: true,
  })

  const response = parseResponse(
    await post(url, request.toSchema().toBER(), options)
  )
  const status = response.status.status
  if (
    status !== PKI_STATUS_GRANTED &&
    status !== PKI_STATUS_GRANTED_WITH_MODS
  ) {
    throw new TimestampError("rejected", `TSA refused the request (${status})`)
  }
  const token = response.timeStampToken
  if (!token) {
    throw new TimestampError("mismatch", "TSA granted without a token")
  }

  const signedData = new pkijs.SignedData({ schema: token.content })
  const tstInfo = tstInfoOf(signedData)
  const imprint = tstInfo.messageImprint
  if (
    imprint.hashAlgorithm.algorithmId !== OID_SHA256 ||
    !sameBytes(imprint.hashedMessage.valueBlock.valueHexView, digest)
  ) {
    throw new TimestampError("mismatch", "Token imprint differs from request")
  }
  const echoed = tstInfo.nonce?.valueBlock.valueHexView
  if (!echoed || !sameBytes(echoed, nonce)) {
    throw new TimestampError("mismatch", "Token nonce differs from request")
  }

  const signer = await verifiedSigner(signedData, data)
  return {
    token,
    time: tstInfo.genTime,
    authority: authorityOf(signer, tstInfo, url),
  }
}
