import { describe, expect, test } from "bun:test"
import { X509Certificate } from "node:crypto"
import {
  openSigningKey,
  Pkcs12Error,
  type Pkcs12FailureKind,
  readPkcs12,
} from "#shared/pkcs12"
import {
  P12_PASSWORD,
  type P12Fixture,
  p12Fixture,
} from "#tests/fixtures/certificate-files"

async function read(name: P12Fixture, password = P12_PASSWORD) {
  return readPkcs12(await p12Fixture(name), password)
}

async function failureOf(name: P12Fixture, password = P12_PASSWORD) {
  try {
    await read(name, password)
  } catch (error) {
    if (error instanceof Pkcs12Error) return error.kind
    throw error
  }
  throw new Error(`${name} was accepted`)
}

describe("readPkcs12", () => {
  test("reads the metadata of a Spanish personal certificate", async () => {
    const metadata = await read("rsa")

    expect(metadata).toMatchObject({
      commonName: "ESPAÑOL PÉREZ JUAN - 12345678Z",
      givenName: "JUAN",
      surname: "ESPAÑOL PÉREZ",
      taxId: "12345678Z",
      issuerCommonName: "AC PRUEBAS AUTOFIRMAS",
      keyAlgorithm: "RSA",
    })
    expect(metadata.fingerprintSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(metadata.serialNumber).toMatch(/^[0-9A-F]+$/)
    expect(metadata.notBefore.getTime()).toBeLessThan(
      metadata.notAfter.getTime()
    )
  })

  test("opens legacy 3DES/RC2 exports like modern ones", async () => {
    const legacy = await read("rsa-legacy")
    const modern = await read("rsa")

    expect(legacy).toEqual(modern)
  })

  test("reads EC keys", async () => {
    const metadata = await read("ec")

    expect(metadata.keyAlgorithm).toBe("EC")
    expect(metadata.taxId).toBe("12345678Z")
  })

  test("leaves the tax id empty when the subject has no serialNumber", async () => {
    const metadata = await read("no-tax-id")

    expect(metadata.commonName).toBe("PRUEBA SIN NIF")
    expect(metadata.taxId).toBeNull()
    expect(metadata.givenName).toBeNull()
    expect(metadata.surname).toBeNull()
  })

  test("rejects a wrong password", async () => {
    expect(await failureOf("rsa", "wrong")).toBe("wrong-password")
    expect(await failureOf("rsa-legacy", "wrong")).toBe("wrong-password")
  })

  test("never puts the password in the error message", async () => {
    try {
      await read("rsa", "secret-password-123")
    } catch (error) {
      expect(String(error)).not.toContain("secret-password-123")
    }
  })

  test.each([
    ["not-a-p12", "invalid-file"],
    ["no-key", "no-key"],
    ["two-keys", "several-keys"],
    ["mismatched", "no-matching-certificate"],
    ["encipherment", "not-for-signing"],
  ] satisfies [P12Fixture, Pkcs12FailureKind][])(
    "rejects %s as %s",
    async (name, kind) => {
      expect(await failureOf(name)).toBe(kind)
    }
  )
})

describe("openSigningKey", () => {
  // Signs a probe with the returned key and verifies it with the returned
  // certificate's public key: proves key and certificate belong together.
  async function probe(name: "rsa" | "ec") {
    const identity = await openSigningKey(await p12Fixture(name), P12_PASSWORD)
    const algorithm = identity.privateKey.algorithm
    const params =
      algorithm.name === "ECDSA"
        ? { name: "ECDSA", hash: "SHA-256" }
        : { name: "RSASSA-PKCS1-v1_5" }
    const data = new TextEncoder().encode("probe")
    const signature = await crypto.subtle.sign(
      params,
      identity.privateKey,
      data
    )
    const publicKey = new X509Certificate(identity.certificate).publicKey
    const verifyKey = await crypto.subtle.importKey(
      "spki",
      new Uint8Array(publicKey.export({ format: "der", type: "spki" })),
      algorithm,
      false,
      ["verify"]
    )
    return {
      identity,
      verified: await crypto.subtle.verify(params, verifyKey, signature, data),
    }
  }

  test("returns a usable RSA key with its certificate and chain", async () => {
    const { identity, verified } = await probe("rsa")

    expect(verified).toBe(true)
    expect(identity.metadata.keyAlgorithm).toBe("RSA")
    expect(identity.privateKey.extractable).toBe(false)
    expect(identity.chain).toHaveLength(1)
  })

  test("returns a usable EC key", async () => {
    const { identity, verified } = await probe("ec")

    expect(verified).toBe(true)
    expect(identity.metadata.keyAlgorithm).toBe("EC")
  })

  test("rejects a wrong password like readPkcs12", async () => {
    const error = await openSigningKey(await p12Fixture("rsa"), "wrong").then(
      () => undefined,
      (thrown: unknown) => thrown
    )

    expect(error).toBeInstanceOf(Pkcs12Error)
    if (error instanceof Pkcs12Error) expect(error.kind).toBe("wrong-password")
  })
})
