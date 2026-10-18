import { describe, expect, test } from "bun:test"
import {
  constants,
  createHash,
  generateKeyPairSync,
  randomBytes,
  verify,
} from "node:crypto"
import {
  RawSignatureError,
  type RawSignatureHash,
  signRaw,
} from "#shared/raw-signature"

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
})
const ecKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" })

const DIGEST_INFO_PREFIXES: Record<RawSignatureHash, string> = {
  sha256: "3031300d060960864801650304020105000420",
  sha384: "3041300d060960864801650304020205000430",
  sha512: "3051300d060960864801650304020305000440",
}

const HASHES: RawSignatureHash[] = ["sha256", "sha384", "sha512"]

function digestOf(hash: RawSignatureHash, message: Uint8Array) {
  return createHash(hash).update(message).digest()
}

describe("signRaw rsa-pkcs1", () => {
  for (const hash of HASHES) {
    test(`signs a ${hash} DigestInfo that verifies over the message`, () => {
      const message = randomBytes(200)
      const digestInfo = Buffer.concat([
        Buffer.from(DIGEST_INFO_PREFIXES[hash], "hex"),
        digestOf(hash, message),
      ])

      const signature = signRaw(privateKey, { name: "rsa-pkcs1" }, digestInfo)

      expect(verify(hash, message, publicKey, signature)).toBe(true)
    })
  }

  test("rejects a bare hash without its DigestInfo", () => {
    expect(() =>
      signRaw(
        privateKey,
        { name: "rsa-pkcs1" },
        digestOf("sha256", randomBytes(8))
      )
    ).toThrow(RawSignatureError)
  })

  test("rejects a SHA-1 DigestInfo", () => {
    const sha1 = Buffer.concat([
      Buffer.from("3021300906052b0e03021a05000414", "hex"),
      createHash("sha1").update("x").digest(),
    ])
    expect(() => signRaw(privateKey, { name: "rsa-pkcs1" }, sha1)).toThrow(
      RawSignatureError
    )
  })
})

describe("signRaw rsa-pss", () => {
  for (const hash of HASHES) {
    test(`signs a ${hash} hash that verifies over the message`, () => {
      const message = randomBytes(200)
      const digest = digestOf(hash, message)
      const saltLength = digest.length

      const signature = signRaw(
        privateKey,
        { name: "rsa-pss", hash, saltLength },
        digest
      )

      expect(
        verify(
          hash,
          message,
          {
            key: publicKey,
            padding: constants.RSA_PKCS1_PSS_PADDING,
            saltLength,
          },
          signature
        )
      ).toBe(true)
    })
  }

  test("signs with an empty salt", () => {
    const message = randomBytes(64)
    const signature = signRaw(
      privateKey,
      { name: "rsa-pss", hash: "sha256", saltLength: 0 },
      digestOf("sha256", message)
    )

    expect(
      verify(
        "sha256",
        message,
        {
          key: publicKey,
          padding: constants.RSA_PKCS1_PSS_PADDING,
          saltLength: 0,
        },
        signature
      )
    ).toBe(true)
  })

  test("rejects a hash of the wrong length", () => {
    expect(() =>
      signRaw(
        privateKey,
        { name: "rsa-pss", hash: "sha256", saltLength: 32 },
        randomBytes(20)
      )
    ).toThrow(RawSignatureError)
  })

  test("rejects a salt longer than the hash", () => {
    expect(() =>
      signRaw(
        privateKey,
        { name: "rsa-pss", hash: "sha256", saltLength: 33 },
        randomBytes(32)
      )
    ).toThrow(RawSignatureError)
  })

  test("rejects an EC key", () => {
    expect(() =>
      signRaw(
        ecKey.privateKey,
        { name: "rsa-pss", hash: "sha256", saltLength: 32 },
        randomBytes(32)
      )
    ).toThrow(RawSignatureError)
  })
})
