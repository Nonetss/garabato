import { beforeEach, describe, expect, test } from "bun:test"
import * as pkijs from "pkijs"
import { readPkcs12 } from "#shared/pkcs12"
import { P12_PASSWORD, p12Fixture } from "#tests/fixtures/certificate-files"
import {
  createFakeTsa,
  FAKE_TSA_TIME,
  FAKE_TSA_URL,
  type FakeTsaMode,
} from "#tests/fixtures/tsa"
import {
  requestTimestamp,
  TimestampError,
  type TimestampErrorKind,
} from "#v1/document/pades/timestamp"

const tsa = createFakeTsa()

const SIGNATURE_VALUE = new TextEncoder().encode("signature value")

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
}

async function failureOf(mode: FakeTsaMode) {
  tsa.setMode(mode)
  try {
    await tsa.timestamper(SIGNATURE_VALUE)
  } catch (error) {
    return error
  }
  throw new Error(`expected mode ${mode} to fail`)
}

beforeEach(() => tsa.reset())

describe("requestTimestamp", () => {
  test("returns a checked token with the TSA's time and name", async () => {
    const result = await tsa.timestamper(SIGNATURE_VALUE)

    const { commonName } = readPkcs12(await p12Fixture("rsa"), P12_PASSWORD)
    expect(result.time).toEqual(FAKE_TSA_TIME)
    expect(result.authority).toBe(commonName)
    expect(result.token.contentType).toBe(pkijs.ContentInfo.SIGNED_DATA)
  })

  test("asks for the SHA-256 of the data with a nonce and the TSA certificate", async () => {
    await tsa.timestamper(SIGNATURE_VALUE)

    const [request] = tsa.requests
    expect(request?.certReq).toBe(true)
    expect(request?.nonce).toBeDefined()
    expect(
      Array.from(
        request?.messageImprint.hashedMessage.valueBlock.valueHexView ?? []
      )
    ).toEqual(Array.from(await sha256(SIGNATURE_VALUE)))
  })

  test.each([
    ["unreachable", "unreachable"],
    ["http-error", "http"],
    ["rejected", "rejected"],
    ["wrong-imprint", "mismatch"],
    ["wrong-nonce", "mismatch"],
    ["bad-signature", "mismatch"],
  ] satisfies [FakeTsaMode, TimestampErrorKind][])(
    "%s fails as %s",
    async (mode, kind) => {
      const error = await failureOf(mode)
      expect(error).toBeInstanceOf(TimestampError)
      if (error instanceof TimestampError) expect(error.kind).toBe(kind)
    }
  )

  test("gives up when the TSA does not answer in time", async () => {
    const hanging = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(init.signal?.reason)
        )
      })
    const error = await requestTimestamp(FAKE_TSA_URL, SIGNATURE_VALUE, {
      fetch: hanging,
      timeoutMs: 20,
    }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(TimestampError)
    if (error instanceof TimestampError) expect(error.kind).toBe("unreachable")
  })
})
