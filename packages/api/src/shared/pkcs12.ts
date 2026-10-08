import { createPrivateKey, type KeyObject, X509Certificate } from "node:crypto"
import forge from "node-forge"

export type Pkcs12FailureKind =
  | "wrong-password"
  | "invalid-file"
  | "no-key"
  | "several-keys"
  | "no-matching-certificate"
  | "unsupported-key"
  | "not-for-signing"

export class Pkcs12Error extends Error {
  readonly kind: Pkcs12FailureKind

  constructor(kind: Pkcs12FailureKind) {
    // Never include the password or file contents in the message: it can
    // end up in logs.
    super(`PKCS#12 rejected: ${kind}`)
    this.kind = kind
  }
}

export type KeyAlgorithm = "RSA" | "EC"

export type CertificateMetadata = {
  commonName: string
  givenName: string | null
  surname: string | null
  taxId: string | null
  issuerCommonName: string
  serialNumber: string
  fingerprintSha256: string
  keyAlgorithm: KeyAlgorithm
  notBefore: Date
  notAfter: Date
}

// PKCS#12 bag types (forge types its oid table as possibly undefined).
const KEY_BAG_OID = "1.2.840.113549.1.12.10.1.1"
const SHROUDED_KEY_BAG_OID = "1.2.840.113549.1.12.10.1.2"
const CERT_BAG_OID = "1.2.840.113549.1.12.10.1.3"
const KEY_USAGE_OID = "2.5.29.15"
const BIT_STRING_TAG = 0x03
// KeyUsage BIT STRING: bit 0 digitalSignature (0x80), bit 1
// nonRepudiation (0x40), both in the first content byte.
const SIGNING_KEY_USAGE_BITS = 0x80 | 0x40

// forge reports a wrong password as a failed MAC check or, for files without
// a MAC, as a shrouded key bag it cannot decrypt.
const WRONG_PASSWORD = /MAC could not be verified|wrong password/i

function parseDer(bytes: Uint8Array) {
  try {
    return forge.asn1.fromDer(forge.util.binary.raw.encode(bytes))
  } catch {
    throw new Pkcs12Error("invalid-file")
  }
}

function decode(bytes: Uint8Array, password: string) {
  const asn1 = parseDer(bytes)
  try {
    return forge.pkcs12.pkcs12FromAsn1(asn1, false, password)
  } catch (error) {
    if (error instanceof Error && WRONG_PASSWORD.test(error.message)) {
      throw new Pkcs12Error("wrong-password")
    }
    throw new Pkcs12Error("invalid-file")
  }
}

function bagsOf(p12: forge.pkcs12.Pkcs12Pfx, bagType: string) {
  return p12.getBags({ bagType })[bagType] ?? []
}

function derOf(node: forge.asn1.Asn1) {
  return Buffer.from(forge.asn1.toDer(node).getBytes(), "binary")
}

// forge models RSA keys and certificates; anything else (EC) is left as raw
// ASN.1 in `bag.asn1`, which node:crypto reads fine.
function privateKeys(p12: forge.pkcs12.Pkcs12Pfx) {
  const bags = [
    ...bagsOf(p12, SHROUDED_KEY_BAG_OID),
    ...bagsOf(p12, KEY_BAG_OID),
  ]
  return bags.map((bag) => {
    const der = bag.key
      ? derOf(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(bag.key)))
      : derOf(bag.asn1)
    return createPrivateKey({ key: der, format: "der", type: "pkcs8" })
  })
}

function certificates(p12: forge.pkcs12.Pkcs12Pfx) {
  return bagsOf(p12, CERT_BAG_OID).map((bag) => {
    const der = bag.cert
      ? derOf(forge.pki.certificateToAsn1(bag.cert))
      : derOf(bag.asn1)
    return new X509Certificate(der)
  })
}

function children(node: forge.asn1.Asn1) {
  if (typeof node.value === "string") return []
  return node.value
}

function oidOf(node: forge.asn1.Asn1 | undefined) {
  if (!node || typeof node.value !== "string") return undefined
  return forge.asn1.derToOid(node.value)
}

// Reads the KeyUsage extension from the certificate DER; node:crypto only
// exposes the extended key usage. A certificate without the extension may be
// used for any purpose.
function allowsSigning(certificate: X509Certificate) {
  const asn1 = forge.asn1.fromDer(
    forge.util.binary.raw.encode(new Uint8Array(certificate.raw))
  )
  const [tbs] = children(asn1)
  if (!tbs) return true
  const extensions = children(tbs).find(
    (node) =>
      node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && node.type === 3
  )
  if (!extensions) return true
  // [3] EXPLICIT wraps the SEQUENCE OF Extension.
  const [extensionList] = children(extensions)
  if (!extensionList) return true
  const keyUsage = children(extensionList).find(
    (extension) => oidOf(children(extension)[0]) === KEY_USAGE_OID
  )
  if (!keyUsage) return true
  const octets = children(keyUsage).at(-1)
  if (!octets || typeof octets.value !== "string") return true
  // extnValue holds a short DER BIT STRING: tag, length, unused-bit count,
  // then the byte with bits 0-7. Read by hand so forge does not try to decode
  // the bits as nested ASN.1.
  const der = octets.value
  if (der.charCodeAt(0) !== BIT_STRING_TAG || der.length < 4) return true
  return (der.charCodeAt(3) & SIGNING_KEY_USAGE_BITS) !== 0
}

// Parses the multi-line "KEY=value" distinguished name node:crypto returns.
function nameFields(name: string) {
  const fields = new Map<string, string>()
  for (const line of name.split("\n")) {
    const separator = line.indexOf("=")
    if (separator > 0 && !fields.has(line.slice(0, separator))) {
      fields.set(line.slice(0, separator), line.slice(separator + 1))
    }
  }
  return fields
}

function commonNameOf(name: string) {
  const commonName = nameFields(name).get("CN")
  if (commonName) return commonName
  return name.split("\n").join(", ")
}

// Spanish certificates carry the NIF/NIE in serialNumber as "IDCES-<nif>".
function taxIdOf(serial: string | undefined) {
  if (!serial) return null
  return serial.replace(/^IDC[A-Z]{2}-/, "")
}

function keyAlgorithmOf(key: KeyObject): KeyAlgorithm {
  if (key.asymmetricKeyType === "rsa") return "RSA"
  if (key.asymmetricKeyType === "ec") return "EC"
  throw new Pkcs12Error("unsupported-key")
}

/**
 * Opens a PKCS#12 file and returns the public metadata of the certificate
 * that matches its only private key. Throws `Pkcs12Error` when the password
 * is wrong or the file is not a usable signing certificate.
 */
export function readPkcs12(
  bytes: Uint8Array,
  password: string
): CertificateMetadata {
  const p12 = decode(bytes, password)

  const keys = privateKeys(p12)
  const [key] = keys
  if (!key) throw new Pkcs12Error("no-key")
  if (keys.length > 1) throw new Pkcs12Error("several-keys")

  const certificate = certificates(p12).find((candidate) =>
    candidate.checkPrivateKey(key)
  )
  if (!certificate) throw new Pkcs12Error("no-matching-certificate")
  const keyAlgorithm = keyAlgorithmOf(key)
  if (!allowsSigning(certificate)) throw new Pkcs12Error("not-for-signing")

  const subject = nameFields(certificate.subject)
  return {
    commonName: commonNameOf(certificate.subject),
    givenName: subject.get("GN") ?? null,
    surname: subject.get("SN") ?? null,
    taxId: taxIdOf(subject.get("serialNumber")),
    issuerCommonName: commonNameOf(certificate.issuer),
    serialNumber: certificate.serialNumber,
    fingerprintSha256: certificate.fingerprint256
      .replaceAll(":", "")
      .toLowerCase(),
    keyAlgorithm,
    notBefore: certificate.validFromDate,
    notAfter: certificate.validToDate,
  }
}
