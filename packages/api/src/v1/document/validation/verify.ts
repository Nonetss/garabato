import * as pkijs from "pkijs"
import { type CertificateHolder, describeCertificate } from "#shared/pkcs12"
import {
  TimestampError,
  verifyTimestampToken,
} from "#v1/document/pades/timestamp"
import {
  type ExtractedSignature,
  extractSignatures,
  type SignatureCoverage,
} from "#v1/document/validation/extract"
import { type CheckResult, checkTrust } from "#v1/document/validation/trust"

export type { CheckResult } from "#v1/document/validation/trust"

/**
 * `valid`: every check passed. `valid_untrusted`: all but trust.
 * `invalid`: integrity, signature or certificate validity failed.
 * `indeterminate`: the signature could not be checked at all.
 */
export type Verdict = "valid" | "valid_untrusted" | "invalid" | "indeterminate"

export type SignatureChecks = {
  integrity: CheckResult
  signature: CheckResult
  coverage: CheckResult
  certificateValidity: CheckResult
  trust: CheckResult
}

export type TimestampReport = {
  time: Date
  authority: string
  valid: boolean
}

export type SignatureReport = {
  fieldName: string
  subFilter: string | null
  /** PAdES level, only for `ETSI.CAdES.detached` signatures. */
  level: "B-B" | "B-T" | null
  claimedTime: Date | null
  reason: string | null
  location: string | null
  signer: CertificateHolder | null
  timestamp: TimestampReport | null
  coverage: SignatureCoverage
  /** Null when the signature could not be checked (`indeterminate`). */
  checks: SignatureChecks | null
  verdict: Verdict
  /** Why the signature could not be checked; null otherwise. */
  problem: string | null
  /** Revisions other than signatures were added after it. */
  modifiedAfterSigning: boolean
}

export type ValidationOptions = {
  /** Roots to trust instead of the default store (tests). */
  trustAnchors?: pkijs.Certificate[]
}

export type ValidationResult = {
  signatures: SignatureReport[]
  /** The file did not parse as a PDF, so no signature could be read. */
  parseError: boolean
}

const SUPPORTED_SUBFILTERS = ["ETSI.CAdES.detached", "adbe.pkcs7.detached"]
const PADES_SUBFILTER = "ETSI.CAdES.detached"
const OID_MESSAGE_DIGEST = "1.2.840.113549.1.9.4"
const OID_SIGNATURE_TIME_STAMP_TOKEN = "1.2.840.113549.1.9.16.2.14"
const DIGESTS = new Map([
  ["2.16.840.1.101.3.4.2.1", "SHA-256"],
  ["2.16.840.1.101.3.4.2.2", "SHA-384"],
  ["2.16.840.1.101.3.4.2.3", "SHA-512"],
])

/** Signals a signature that cannot be checked, with the reason shown. */
class UncheckableError extends Error {}

function passed(reason: string): CheckResult {
  return { passed: true, reason }
}

function failed(reason: string): CheckResult {
  return { passed: false, reason }
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((byte, index) => byte === b[index])
}

/** The verdict from the checks, in the order the spec gives. */
export function verdictOf(checks: SignatureChecks): Verdict {
  if (
    !checks.integrity.passed ||
    !checks.signature.passed ||
    !checks.certificateValidity.passed
  ) {
    return "invalid"
  }
  if (!checks.trust.passed) return "valid_untrusted"
  return "valid"
}

function signedDataOf(contents: Uint8Array<ArrayBuffer>) {
  try {
    const contentInfo = pkijs.ContentInfo.fromBER(contents)
    return new pkijs.SignedData({ schema: contentInfo.content })
  } catch {
    throw new UncheckableError("La firma no es un CMS legible")
  }
}

function signerCertificateOf(
  signedData: pkijs.SignedData,
  signerInfo: pkijs.SignerInfo
) {
  const certificates = (signedData.certificates ?? []).filter(
    (certificate) => certificate instanceof pkijs.Certificate
  )
  const sid = signerInfo.sid
  const signer = certificates.find(
    (certificate) =>
      sid instanceof pkijs.IssuerAndSerialNumber &&
      certificate.issuer.isEqual(sid.issuer) &&
      certificate.serialNumber.isEqual(sid.serialNumber)
  )
  if (!signer) {
    throw new UncheckableError("La firma no incluye el certificado firmante")
  }
  return { signer, certificates }
}

function digestAlgorithmOf(signerInfo: pkijs.SignerInfo) {
  const name = DIGESTS.get(signerInfo.digestAlgorithm.algorithmId)
  if (!name) {
    throw new UncheckableError(
      `Algoritmo de resumen no admitido (${signerInfo.digestAlgorithm.algorithmId})`
    )
  }
  return name
}

async function integrityOf(
  signature: ExtractedSignature,
  signerInfo: pkijs.SignerInfo,
  digestAlgorithm: string
): Promise<CheckResult> {
  if (!signature.byteRangeValid) {
    return failed("El rango de bytes firmado no es válido")
  }
  const attribute = signerInfo.signedAttrs?.attributes.find(
    (entry) => entry.type === OID_MESSAGE_DIGEST
  )
  const expected = attribute?.values[0]?.valueBlock.valueHexView
  if (!(expected instanceof Uint8Array)) {
    return failed("La firma no incluye el resumen del contenido")
  }
  const actual = new Uint8Array(
    await crypto.subtle.digest(digestAlgorithm, signature.signedBytes)
  )
  if (!sameBytes(actual, expected)) {
    return failed("El contenido firmado ha cambiado desde la firma")
  }
  return passed("El contenido firmado no ha cambiado")
}

async function signatureCheckOf(
  signedData: pkijs.SignedData,
  signedBytes: Uint8Array<ArrayBuffer>
): Promise<CheckResult> {
  try {
    const result = await signedData.verify({
      signer: 0,
      data: signedBytes.buffer,
      checkChain: false,
      extendedMode: true,
    })
    if (result.signatureVerified === true) {
      return passed("La firma criptográfica es correcta")
    }
  } catch {
    // Falls through to the failed result.
  }
  return failed("La firma criptográfica no se corresponde con el certificado")
}

async function timestampOf(
  signerInfo: pkijs.SignerInfo
): Promise<TimestampReport | null> {
  const attribute = signerInfo.unsignedAttrs?.attributes.find(
    (entry) => entry.type === OID_SIGNATURE_TIME_STAMP_TOKEN
  )
  const value = attribute?.values[0]
  if (!value) return null
  const signatureValue = new Uint8Array(
    signerInfo.signature.valueBlock.valueHexView
  )
  try {
    const token = new pkijs.ContentInfo({ schema: value })
    const verified = await verifyTimestampToken(
      token,
      signatureValue,
      "Autoridad desconocida"
    )
    return { time: verified.time, authority: verified.authority, valid: true }
  } catch (error) {
    if (!(error instanceof TimestampError)) throw error
    return null
  }
}

/** The CMS signature is only worth checking over the content it signed. */
function signatureCheckAfter(
  integrity: CheckResult,
  signedData: pkijs.SignedData,
  signedBytes: Uint8Array<ArrayBuffer>
): Promise<CheckResult> {
  if (!integrity.passed) {
    return Promise.resolve(
      failed("No se comprueba: el contenido firmado no coincide")
    )
  }
  return signatureCheckOf(signedData, signedBytes)
}

function coverageCheckOf(coverage: SignatureCoverage): CheckResult {
  if (coverage === "whole") return passed("La firma cubre todo el documento")
  if (coverage === "followed_by_signatures") {
    return passed("Después de esta firma solo se añadieron otras firmas")
  }
  return failed("El documento se modificó después de esta firma")
}

function validityOf(signer: CertificateHolder, checkTime: Date): CheckResult {
  if (checkTime < signer.notBefore) {
    return failed("El certificado aún no era válido en la fecha de firma")
  }
  if (checkTime > signer.notAfter) {
    return failed("El certificado ya había caducado en la fecha de firma")
  }
  return passed("El certificado era válido en la fecha de firma")
}

/** The time the checks judge validity at: proven, then claimed, then now. */
function checkTimeOf(
  timestamp: TimestampReport | null,
  claimedTime: Date | null
) {
  if (timestamp?.valid) return timestamp.time
  if (claimedTime) return claimedTime
  return new Date()
}

function levelOf(subFilter: string | null, timestamp: TimestampReport | null) {
  if (subFilter !== PADES_SUBFILTER) return null
  if (timestamp?.valid) return "B-T"
  return "B-B"
}

function baseReport(signature: ExtractedSignature) {
  return {
    fieldName: signature.fieldName,
    subFilter: signature.subFilter,
    claimedTime: signature.claimedTime,
    reason: signature.reason,
    location: signature.location,
    coverage: signature.coverage,
    modifiedAfterSigning: signature.coverage === "followed_by_changes",
  }
}

function indeterminate(
  signature: ExtractedSignature,
  problem: string
): SignatureReport {
  return {
    ...baseReport(signature),
    level: null,
    signer: null,
    timestamp: null,
    checks: null,
    verdict: "indeterminate",
    problem,
  }
}

async function checkSignature(
  signature: ExtractedSignature,
  options: ValidationOptions
): Promise<SignatureReport> {
  if (signature.byteRange === null) {
    throw new UncheckableError("La firma no tiene un rango de bytes legible")
  }
  if (
    signature.subFilter === null ||
    !SUPPORTED_SUBFILTERS.includes(signature.subFilter)
  ) {
    throw new UncheckableError(
      `Tipo de firma no admitido (${signature.subFilter ?? "sin SubFilter"})`
    )
  }
  const signedData = signedDataOf(signature.contents)
  const signerInfo = signedData.signerInfos[0]
  if (!signerInfo) throw new UncheckableError("La firma no tiene firmante")
  const { signer, certificates } = signerCertificateOf(signedData, signerInfo)
  const digestAlgorithm = digestAlgorithmOf(signerInfo)

  const integrity = await integrityOf(signature, signerInfo, digestAlgorithm)
  const signatureCheck = await signatureCheckAfter(
    integrity,
    signedData,
    signature.signedBytes
  )
  const timestamp = await timestampOf(signerInfo)
  const holder = describeCertificate(new Uint8Array(signer.toSchema().toBER()))
  const checkTime = checkTimeOf(timestamp, signature.claimedTime)
  const checks: SignatureChecks = {
    integrity,
    signature: signatureCheck,
    coverage: coverageCheckOf(signature.coverage),
    certificateValidity: validityOf(holder, checkTime),
    trust: await checkTrust(
      signer,
      certificates,
      checkTime,
      options.trustAnchors
    ),
  }
  return {
    ...baseReport(signature),
    level: levelOf(signature.subFilter, timestamp),
    signer: holder,
    timestamp,
    checks,
    verdict: verdictOf(checks),
    problem: null,
  }
}

async function reportOf(
  signature: ExtractedSignature,
  options: ValidationOptions
): Promise<SignatureReport> {
  try {
    return await checkSignature(signature, options)
  } catch (error) {
    if (error instanceof UncheckableError) {
      return indeterminate(signature, error.message)
    }
    return indeterminate(signature, "La firma no se pudo comprobar")
  }
}

/**
 * Checks every signature embedded in `pdf`: integrity, the CMS signature,
 * coverage, the certificate's validity at the signing time and its chain to
 * a trusted root. Revocation is not checked. Never throws: a file that does
 * not parse answers `parseError`, and a signature that cannot be checked is
 * `indeterminate`.
 */
export async function validateSignatures(
  pdf: Uint8Array<ArrayBuffer>,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const extracted = await extractSignatures(pdf).catch(() => null)
  if (extracted === null) return { signatures: [], parseError: true }
  const signatures: SignatureReport[] = []
  for (const signature of extracted) {
    signatures.push(await reportOf(signature, options))
  }
  return { signatures, parseError: false }
}
