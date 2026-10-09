import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import * as pkijs from "pkijs"
import { openSigningKey } from "#shared/pkcs12"
import { P12_PASSWORD, p12Fixture } from "#tests/fixtures/certificate-files"
import { pdfFixture } from "#tests/fixtures/document-files"
import { signedPdf, withContentChange } from "#tests/fixtures/signed-documents"
import { createFakeTsa, FAKE_TSA_TIME } from "#tests/fixtures/tsa"
import { bundledRoots } from "#v1/document/validation/roots"
import {
  type SignatureChecks,
  type Verdict,
  validateSignatures,
  verdictOf,
} from "#v1/document/validation/verify"

/** Long after the 10-year test certificates expire. */
const AFTER_EXPIRY = new Date("2045-01-01T00:00:00.000Z")

/** The throwaway test CA every PKCS#12 fixture chains to. */
async function testCa() {
  const identity = await openSigningKey(await p12Fixture("rsa"), P12_PASSWORD)
  const [ca] = identity.chain
  if (!ca) throw new Error("the rsa fixture carries no CA")
  return pkijs.Certificate.fromBER(ca)
}

async function onlyReport(
  pdf: Uint8Array<ArrayBuffer>,
  options: Parameters<typeof validateSignatures>[1] = {}
) {
  const result = await validateSignatures(pdf, options)
  expect(result.parseError).toBe(false)
  expect(result.signatures).toHaveLength(1)
  const [report] = result.signatures
  if (!report) throw new Error("no report")
  return report
}

/** Flips a byte of the binary comment after the header: inside the signed
 *  range, harmless to the parser. */
function tamperedHeaderComment(pdf: Uint8Array<ArrayBuffer>) {
  const copy = new Uint8Array(pdf)
  const at = copy.indexOf(0x25, 1) + 1
  copy[at] = (copy[at] ?? 0) ^ 0x01
  return copy
}

/** Rewrites the SubFilter name in place, keeping every offset. */
function withSubFilter(pdf: Uint8Array<ArrayBuffer>, name: string) {
  const text = Buffer.from(pdf).toString("latin1")
  const current = "/ETSI.CAdES.detached"
  const replacement = `/${name}`.padEnd(current.length, " ")
  return new Uint8Array(
    Buffer.from(text.replace(current, replacement), "latin1")
  )
}

function allPassing(): SignatureChecks {
  const ok = { passed: true, reason: "" }
  return {
    integrity: ok,
    signature: ok,
    coverage: ok,
    certificateValidity: ok,
    trust: ok,
  }
}

describe("validateSignatures", () => {
  test("an unsigned PDF has no signatures", async () => {
    expect(await validateSignatures(await pdfFixture("plain"))).toEqual({
      signatures: [],
      parseError: false,
    })
  })

  test("a file that is not a PDF is a parse error", async () => {
    expect(await validateSignatures(await pdfFixture("not-a-pdf"))).toEqual({
      signatures: [],
      parseError: true,
    })
  })

  test.each(["rsa", "ec"] satisfies ("rsa" | "ec")[])(
    "a %s garabato signature from an untrusted CA is valid but unrecognized",
    async (certificate) => {
      const report = await onlyReport(await signedPdf({ certificate }))

      expect(report.verdict).toBe("valid_untrusted")
      expect(report.level).toBe("B-B")
      expect(report.signer?.taxId).toBe("12345678Z")
      expect(report.checks?.integrity.passed).toBe(true)
      expect(report.checks?.signature.passed).toBe(true)
      expect(report.checks?.coverage.passed).toBe(true)
      expect(report.checks?.certificateValidity.passed).toBe(true)
      expect(report.checks?.trust).toEqual({
        passed: false,
        reason: expect.stringContaining("AC PRUEBAS AUTOFIRMAS"),
      })
      expect(report.modifiedAfterSigning).toBe(false)
    }
  )

  test("the same signature is valid once its CA is trusted", async () => {
    const report = await onlyReport(await signedPdf(), {
      trustAnchors: [await testCa()],
    })
    expect(report.verdict).toBe("valid")
    expect(report.checks?.trust.reason).toContain("AC PRUEBAS AUTOFIRMAS")
  })

  test("a tampered byte makes it invalid on integrity", async () => {
    const report = await onlyReport(tamperedHeaderComment(await signedPdf()))
    expect(report.verdict).toBe("invalid")
    expect(report.checks?.integrity.passed).toBe(false)
    expect(report.checks?.signature.passed).toBe(false)
  })

  test("a claimed time after the certificate expired makes it invalid", async () => {
    const report = await onlyReport(
      await signedPdf({ signingTime: AFTER_EXPIRY })
    )
    expect(report.verdict).toBe("invalid")
    expect(report.checks?.certificateValidity.passed).toBe(false)
  })

  test("a timestamp makes it B-T and judges validity at the token's time", async () => {
    const tsa = createFakeTsa()
    const report = await onlyReport(
      await signedPdf({
        signingTime: AFTER_EXPIRY,
        timestamper: tsa.timestamper,
      })
    )
    expect(report.level).toBe("B-T")
    expect(report.timestamp).toMatchObject({
      time: FAKE_TSA_TIME,
      valid: true,
    })
    expect(report.checks?.certificateValidity.passed).toBe(true)
  })

  test("an unsupported SubFilter is indeterminate", async () => {
    const report = await onlyReport(
      withSubFilter(await signedPdf(), "adbe.x509.rsa_sha1")
    )
    expect(report.verdict).toBe("indeterminate")
    expect(report.checks).toBeNull()
    expect(report.problem).toContain("adbe.x509.rsa_sha1")
  })

  test("a change after signing keeps the verdict but warns", async () => {
    const report = await onlyReport(
      await withContentChange(await signedPdf()),
      {
        trustAnchors: [await testCa()],
      }
    )
    expect(report.verdict).toBe("valid")
    expect(report.coverage).toBe("followed_by_changes")
    expect(report.modifiedAfterSigning).toBe(true)
    expect(report.checks?.coverage.passed).toBe(false)
  })

  test("two signatures are reported in signing order", async () => {
    const once = await signedPdf()
    const twice = await signedPdf({ pdf: once, certificate: "ec" })
    const { signatures } = await validateSignatures(twice)
    expect(signatures.map((report) => report.coverage)).toEqual([
      "followed_by_signatures",
      "whole",
    ])
    expect(signatures.every((report) => report.checks?.integrity.passed)).toBe(
      true
    )
  })
})

describe("verdictOf", () => {
  test.each([
    ["integrity", "invalid"],
    ["signature", "invalid"],
    ["certificateValidity", "invalid"],
    ["trust", "valid_untrusted"],
    ["coverage", "valid"],
  ] satisfies [keyof SignatureChecks, Verdict][])(
    "a failed %s check gives %s",
    (check, verdict) => {
      const checks = allPassing()
      checks[check] = { passed: false, reason: "" }
      expect(verdictOf(checks)).toBe(verdict)
    }
  )

  test("integrity outranks trust", () => {
    const checks = allPassing()
    checks.integrity = { passed: false, reason: "" }
    checks.trust = { passed: false, reason: "" }
    expect(verdictOf(checks)).toBe("invalid")
  })
})

describe("bundled roots", () => {
  test("pin the official certificates by SHA-256", () => {
    const pinned = new Map([
      [
        "AC RAIZ FNMT-RCM",
        "ebc5570c29018c4d67b1aa127baf12f703b4611ebc17b7dab5573894179b93fa",
      ],
      [
        "AC RAIZ DNIE 2",
        "c5c380eb9240fb36a16e15f5d6bad0bf611f6d03f0ef24229919e7d2d8126c11",
      ],
    ])
    for (const root of bundledRoots) {
      const body = root.pem
        .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
        .replace(/\s+/g, "")
      const der = Buffer.from(body, "base64")
      const sha256 = createHash("sha256").update(der).digest("hex")
      expect(sha256).toBe(root.sha256)
      expect(pinned.get(root.name)).toBe(sha256)
    }
    expect(bundledRoots.map((root) => root.name).sort()).toEqual(
      [...pinned.keys()].sort()
    )
  })
})
