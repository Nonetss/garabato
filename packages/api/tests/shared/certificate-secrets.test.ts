import { describe, expect, test } from "bun:test"
import { certificateRow } from "@nonete/db/testing"
import {
  certificateScope,
  openCertificateFile,
  openRememberedPassword,
  rejectPkcs12,
} from "#shared/certificate-secrets"
import { Pkcs12Error } from "#shared/pkcs12"
import { vault } from "#shared/vault"
import { expectErrorCode } from "#tests/fixtures/errors"

const ID = "00000000-0000-4000-8000-0000000000c1"
const p12 = new TextEncoder().encode("PKCS#12 bytes")

async function sealedRow(password: string | null) {
  const dataKey = vault.newDataKey()
  const scope = certificateScope(ID)
  const encryptedPassword =
    password === null
      ? null
      : await vault.seal(
          dataKey,
          scope,
          "password",
          new TextEncoder().encode(password)
        )
  return certificateRow({
    id: ID,
    encryptedDataKey: await vault.wrapDataKey(scope, dataKey),
    encryptedP12: await vault.seal(dataKey, scope, "p12", p12),
    encryptedPassword,
  })
}

describe("openCertificateFile", () => {
  test("opens the sealed PKCS#12 file", async () => {
    const opened = await openCertificateFile(await sealedRow(null))

    expect(opened.p12).toEqual(p12)
  })

  test("fails as a server error for a row of another id", async () => {
    const row = {
      ...(await sealedRow(null)),
      id: "00000000-0000-4000-8000-0000000000c2",
    }

    await expectErrorCode(openCertificateFile(row), "INTERNAL_SERVER_ERROR")
  })

  test("fails as a server error for a shredded row", async () => {
    const row = certificateRow({ encryptedDataKey: null, encryptedP12: null })

    await expectErrorCode(openCertificateFile(row), "INTERNAL_SERVER_ERROR")
  })
})

describe("openRememberedPassword", () => {
  test("returns the remembered password or null", async () => {
    const remembered = await sealedRow("1234")
    const forgotten = await sealedRow(null)
    const { dataKey } = await openCertificateFile(remembered)

    expect(await openRememberedPassword(remembered, dataKey)).toBe("1234")
    expect(await openRememberedPassword(forgotten, dataKey)).toBeNull()
  })
})

describe("rejectPkcs12", () => {
  test("turns a PKCS#12 failure into a Spanish BAD_REQUEST", async () => {
    await expectErrorCode(
      Promise.reject(new Pkcs12Error("wrong-password")).catch(rejectPkcs12),
      "BAD_REQUEST"
    )
  })

  test("rethrows any other error unchanged", () => {
    const error = new Error("boom")
    expect(() => rejectPkcs12(error)).toThrow(error)
  })
})
