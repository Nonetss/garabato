import {
  constants,
  createHash,
  type KeyObject,
  privateEncrypt,
  randomBytes,
} from "node:crypto"

/** Hashes a TLS client signature may use. */
export type RawSignatureHash = "sha256" | "sha384" | "sha512"

/**
 * What the browser token asks to sign, as the PKCS#11 mechanism gives it:
 * `rsa-pkcs1` is `CKM_RSA_PKCS` over a DigestInfo the caller encoded (TLS
 * 1.2); `rsa-pss` is `CKM_RSA_PKCS_PSS` over a hash the caller computed
 * (TLS 1.3, and TLS 1.2 when both sides offer it).
 */
export type RawSignatureMechanism =
  | { name: "rsa-pkcs1" }
  | { name: "rsa-pss"; hash: RawSignatureHash; saltLength: number }

/** The data does not fit the mechanism; the caller sent something wrong. */
export class RawSignatureError extends Error {}

const HASH_LENGTHS = { sha256: 32, sha384: 48, sha512: 64 } as const

// DER prefix of DigestInfo for each hash (RFC 8017 §9.2, note 1).
const DIGEST_INFO_PREFIXES = [
  { hash: "sha256", prefix: "3031300d060960864801650304020105000420" },
  { hash: "sha384", prefix: "3041300d060960864801650304020205000430" },
  { hash: "sha512", prefix: "3051300d060960864801650304020305000440" },
] satisfies { hash: RawSignatureHash; prefix: string }[]

function isDigestInfo(data: Uint8Array) {
  return DIGEST_INFO_PREFIXES.some(({ hash, prefix }) => {
    const header = Buffer.from(prefix, "hex")
    return (
      data.length === header.length + HASH_LENGTHS[hash] &&
      header.equals(data.subarray(0, header.length))
    )
  })
}

function mgf1(seed: Uint8Array, length: number, hash: RawSignatureHash) {
  const blocks: Buffer[] = []
  let produced = 0
  for (let counter = 0; produced < length; counter++) {
    const counterBytes = Buffer.alloc(4)
    counterBytes.writeUInt32BE(counter)
    const block = createHash(hash).update(seed).update(counterBytes).digest()
    blocks.push(block)
    produced += block.length
  }
  return Buffer.concat(blocks).subarray(0, length)
}

function modulusBits(key: KeyObject) {
  const bits = key.asymmetricKeyDetails?.modulusLength
  if (key.asymmetricKeyType !== "rsa" || bits === undefined) {
    throw new RawSignatureError("Only RSA keys can sign for the token")
  }
  return bits
}

// EMSA-PSS-ENCODE (RFC 8017 §9.1.1) over a hash the caller computed, then
// raw RSA: node:crypto's `sign` always hashes the message itself.
function signPss(
  key: KeyObject,
  digest: Uint8Array,
  hash: RawSignatureHash,
  saltLength: number
) {
  const hashLength = HASH_LENGTHS[hash]
  if (digest.length !== hashLength) {
    throw new RawSignatureError(
      `A ${hash} hash has ${hashLength} bytes, got ${digest.length}`
    )
  }
  if (!Number.isInteger(saltLength) || saltLength < 0) {
    throw new RawSignatureError("Invalid salt length")
  }
  if (saltLength > hashLength) {
    throw new RawSignatureError("The salt is longer than the hash")
  }
  const bits = modulusBits(key)
  const encodedBits = bits - 1
  const encodedLength = Math.ceil(encodedBits / 8)
  const salt = randomBytes(saltLength)
  const h = createHash(hash)
    .update(Buffer.alloc(8))
    .update(digest)
    .update(salt)
    .digest()
  const db = Buffer.concat([
    Buffer.alloc(encodedLength - saltLength - hashLength - 2),
    Buffer.from([0x01]),
    salt,
  ])
  const mask = mgf1(h, db.length, hash)
  const maskedDb = Buffer.alloc(db.length)
  for (let i = 0; i < db.length; i++) {
    maskedDb[i] = (db[i] ?? 0) ^ (mask[i] ?? 0)
  }
  maskedDb[0] = (maskedDb[0] ?? 0) & (0xff >> (8 * encodedLength - encodedBits))
  const encoded = Buffer.concat([maskedDb, h, Buffer.from([0xbc])])
  const block = Buffer.concat([
    Buffer.alloc(Math.ceil(bits / 8) - encoded.length),
    encoded,
  ])
  return privateEncrypt({ key, padding: constants.RSA_NO_PADDING }, block)
}

function signPkcs1(key: KeyObject, digestInfo: Uint8Array) {
  modulusBits(key)
  if (!isDigestInfo(digestInfo)) {
    throw new RawSignatureError(
      "Expected a DigestInfo for SHA-256, SHA-384 or SHA-512"
    )
  }
  return privateEncrypt(
    { key, padding: constants.RSA_PKCS1_PADDING },
    digestInfo
  )
}

/**
 * Signs what a TLS client handshake asks the browser token for. Throws
 * `RawSignatureError` when the data does not fit the mechanism.
 */
export function signRaw(
  key: KeyObject,
  mechanism: RawSignatureMechanism,
  data: Uint8Array
): Uint8Array {
  if (mechanism.name === "rsa-pkcs1") {
    return new Uint8Array(signPkcs1(key, data))
  }
  return new Uint8Array(
    signPss(key, data, mechanism.hash, mechanism.saltLength)
  )
}
