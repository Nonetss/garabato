import * as asn1js from "asn1js"
import * as pkijs from "pkijs"
import { openSigningKey } from "#shared/pkcs12"
import { P12_PASSWORD, p12Fixture } from "#tests/fixtures/certificate-files"
import {
  type FetchLike,
  requestTimestamp,
  type Timestamper,
} from "#v1/document/pades/timestamp"

const OID_TST_INFO = "1.2.840.113549.1.9.16.1.4"

/** The `genTime` every granted token carries. */
export const FAKE_TSA_TIME = new Date("2026-10-09T10:15:02Z")
export const FAKE_TSA_URL = "https://tsa.test/tsr"

/**
 * How the fake TSA answers the next requests: a valid token, a refusal, a
 * token over another imprint or nonce, an HTTP 500, no answer at all, or a
 * token whose signature does not verify.
 */
export type FakeTsaMode =
  | "granted"
  | "rejected"
  | "wrong-imprint"
  | "wrong-nonce"
  | "http-error"
  | "unreachable"
  | "bad-signature"

async function tsaIdentity() {
  return openSigningKey(await p12Fixture("rsa"), P12_PASSWORD)
}

function flipped(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes)
  copy[0] = (copy[0] ?? 0) ^ 0xff
  return copy
}

/** The imprint the token answers with: the request's, or a corrupted one. */
function answeredImprint(request: pkijs.TimeStampReq, mode: FakeTsaMode) {
  const hashed = request.messageImprint.hashedMessage.valueBlock.valueHexView
  if (mode === "wrong-imprint") return flipped(hashed)
  return hashed
}

/** The nonce the token echoes: the request's, or another one. */
function answeredNonce(request: pkijs.TimeStampReq, mode: FakeTsaMode) {
  if (mode === "wrong-nonce") return new asn1js.Integer({ value: 42 })
  return request.nonce
}

async function tokenFor(
  request: pkijs.TimeStampReq,
  mode: FakeTsaMode
): Promise<pkijs.ContentInfo> {
  const identity = await tsaIdentity()
  const certificate = pkijs.Certificate.fromBER(identity.certificate)
  const messageImprint = new pkijs.MessageImprint({
    hashAlgorithm: request.messageImprint.hashAlgorithm,
    hashedMessage: new asn1js.OctetString({
      valueHex: answeredImprint(request, mode),
    }),
  })
  const tstInfo = new pkijs.TSTInfo({
    version: 1,
    policy: "1.2.3.4.1",
    messageImprint,
    serialNumber: new asn1js.Integer({ value: 1 }),
    genTime: FAKE_TSA_TIME,
    nonce: answeredNonce(request, mode),
  })

  // Assigned after construction: the constructor re-encodes `eContent` as a
  // constructed OCTET STRING, which pkijs's own TSTInfo check cannot read.
  // Real TSAs send it primitive.
  const encapContentInfo = new pkijs.EncapsulatedContentInfo({
    eContentType: OID_TST_INFO,
  })
  encapContentInfo.eContent = new asn1js.OctetString({
    valueHex: tstInfo.toSchema().toBER(),
  })
  const signedData = new pkijs.SignedData({
    version: 3,
    encapContentInfo,
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({
          issuer: certificate.issuer,
          serialNumber: certificate.serialNumber,
        }),
      }),
    ],
    certificates: [certificate],
  })
  await signedData.sign(identity.privateKey, 0, "SHA-256")
  if (mode === "bad-signature") {
    const signerInfo = signedData.signerInfos[0]
    if (signerInfo) {
      signerInfo.signature = new asn1js.OctetString({
        valueHex: flipped(signerInfo.signature.valueBlock.valueHexView),
      })
    }
  }
  return new pkijs.ContentInfo({
    contentType: pkijs.ContentInfo.SIGNED_DATA,
    content: signedData.toSchema(true),
  })
}

async function answer(body: ArrayBuffer, mode: FakeTsaMode) {
  const request = pkijs.TimeStampReq.fromBER(body)
  if (mode === "rejected") {
    const refusal = new pkijs.TimeStampResp({
      status: new pkijs.PKIStatusInfo({ status: 2 }),
    })
    return refusal.toSchema().toBER()
  }
  const response = new pkijs.TimeStampResp({
    status: new pkijs.PKIStatusInfo({ status: 0 }),
    timeStampToken: await tokenFor(request, mode),
  })
  return response.toSchema().toBER()
}

/**
 * An in-process RFC 3161 TSA that signs tokens with the `rsa` PKCS#12
 * fixture, so its authority is that certificate's CN. Tests drive it with
 * `setMode` and read the requests it received.
 */
export function createFakeTsa() {
  let mode: FakeTsaMode = "granted"
  const requests: pkijs.TimeStampReq[] = []

  const fetch: FetchLike = async (_url, init) => {
    if (mode === "unreachable") throw new TypeError("fetch failed")
    if (mode === "http-error") return new Response("down", { status: 500 })
    const body = init.body
    if (!(body instanceof ArrayBuffer)) {
      throw new Error("fake TSA: expected an ArrayBuffer body")
    }
    requests.push(pkijs.TimeStampReq.fromBER(body))
    return new Response(await answer(body, mode), {
      headers: { "Content-Type": "application/timestamp-reply" },
    })
  }

  const timestamper: Timestamper = (data) =>
    requestTimestamp(FAKE_TSA_URL, data, { fetch })

  return {
    fetch,
    timestamper,
    requests,
    setMode: (next: FakeTsaMode) => {
      mode = next
    },
    reset: () => {
      mode = "granted"
      requests.length = 0
    },
  }
}

/**
 * Stand-in for `#lib/timestamp`, installed by `tests/setup.ts`: no TSA by
 * default (B-B, like an unset `TSA_URL`); `enable()` makes signatures ask
 * `tsa`, the fake TSA, which tests switch between modes.
 */
function createFakeTimestampService() {
  const tsa = createFakeTsa()
  let enabled = false
  return {
    tsa,
    getTimestamper: (): Timestamper | null => {
      if (!enabled) return null
      return tsa.timestamper
    },
    enable: () => {
      enabled = true
    },
    reset: () => {
      enabled = false
      tsa.reset()
    },
  }
}

export const fakeTimestampService = createFakeTimestampService()
