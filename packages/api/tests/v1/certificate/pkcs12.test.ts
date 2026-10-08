import { describe, expect, test } from "bun:test"
import {
  P12_PASSWORD,
  type P12Fixture,
  p12Fixture,
} from "#tests/fixtures/certificate-files"
import {
  Pkcs12Error,
  type Pkcs12FailureKind,
  readPkcs12,
} from "#v1/certificate/pkcs12"

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
