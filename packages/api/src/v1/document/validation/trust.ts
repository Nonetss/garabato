import { rootCertificates } from "node:tls"
import * as pkijs from "pkijs"
import { bundledRoots } from "#v1/document/validation/roots"

/** One check of a signature report: whether it passed and why, in Spanish. */
export type CheckResult = { passed: boolean; reason: string }

const OID_COMMON_NAME = "2.5.4.3"
const OID_ORGANIZATIONAL_UNIT = "2.5.4.11"
const OID_ORGANIZATION = "2.5.4.10"
const PEM_BLOCK =
  /-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/

function certificateOfPem(pem: string): pkijs.Certificate | null {
  const body = PEM_BLOCK.exec(pem)?.[1]
  if (!body) return null
  try {
    return pkijs.Certificate.fromBER(
      new Uint8Array(Buffer.from(body.replace(/\s+/g, ""), "base64"))
    )
  } catch {
    return null
  }
}

/** The Mozilla store shipped with the runtime plus the bundled roots. */
export const defaultTrustAnchors = [
  ...rootCertificates,
  ...bundledRoots.map((r) => r.pem),
]
  .map(certificateOfPem)
  .filter((certificate) => certificate !== null)

/** A readable name: CN, then OU (FNMT's root has only OU), then O. */
export function nameOf(name: pkijs.RelativeDistinguishedNames): string {
  for (const type of [
    OID_COMMON_NAME,
    OID_ORGANIZATIONAL_UNIT,
    OID_ORGANIZATION,
  ]) {
    const value = name.typesAndValues.find((entry) => entry.type === type)
      ?.value.valueBlock.value
    if (typeof value === "string" && value !== "") return value
  }
  return "desconocido"
}

function issuedBy(certificate: pkijs.Certificate, issuer: pkijs.Certificate) {
  return certificate.issuer.isEqual(issuer.subject)
}

/**
 * The last certificate reachable from `signer` through the certificates the
 * signature carries, following issuer names: what the chain ends in when it
 * reaches no trusted root.
 */
function topOfChain(
  certificate: pkijs.Certificate,
  carried: pkijs.Certificate[],
  seen: pkijs.Certificate[] = [certificate]
): pkijs.Certificate {
  const issuer = carried.find(
    (candidate) => issuedBy(certificate, candidate) && !seen.includes(candidate)
  )
  if (!issuer) return certificate
  return topOfChain(issuer, carried, [...seen, issuer])
}

/**
 * Whether the chain built from `signer` and the certificates the signature
 * carries reaches a trusted root, every certificate being valid at
 * `checkDate` (the timestamp's time, or the claimed signing time).
 */
export async function checkTrust(
  signer: pkijs.Certificate,
  carried: pkijs.Certificate[],
  checkDate: Date,
  trustAnchors: pkijs.Certificate[] = defaultTrustAnchors
): Promise<CheckResult> {
  const engine = new pkijs.CertificateChainValidationEngine({
    trustedCerts: trustAnchors,
    certs: [...carried.filter((c) => c !== signer), signer],
    checkDate,
  })
  const result = await engine.verify()
  const root = result.certificatePath?.at(-1)
  if (result.result && root) {
    return {
      passed: true,
      reason: `La cadena llega a la raíz de confianza «${nameOf(root.subject)}»`,
    }
  }
  const top = topOfChain(signer, carried)
  const anchored = trustAnchors.some((anchor) => issuedBy(top, anchor))
  if (anchored) {
    return {
      passed: false,
      reason: `La cadena no es válida en la fecha de firma: ${result.resultMessage}`,
    }
  }
  return {
    passed: false,
    reason: `La cadena termina en «${nameOf(top.issuer)}», que no es una raíz de confianza`,
  }
}
