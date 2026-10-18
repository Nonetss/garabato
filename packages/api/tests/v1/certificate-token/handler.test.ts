import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import {
  constants,
  createHash,
  randomBytes,
  verify,
  X509Certificate,
} from "node:crypto"
import { auth } from "@nonete/auth"
import { encryptTwoFactorSecret } from "@nonete/auth/two-factor"
import {
  type CertificateRow,
  certificateRow,
  stepArgs,
  userRow,
} from "@nonete/db/testing"
import { installCodes } from "#shared/install-codes"
import { moduleFiles } from "#shared/token-module"
import { tokenWindows } from "#shared/token-window"
import { totpAt } from "#shared/totp"
import { type VaultScope, vault } from "#shared/vault"
import { listedApiKey, listedApiKeys } from "#tests/fixtures/auth"
import { P12_PASSWORD, p12Fixture } from "#tests/fixtures/certificate-files"
import {
  adminContext,
  anonymousContext,
  userContext,
} from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { expectErrorCode } from "#tests/fixtures/errors"
import {
  certificateTokenHandler,
  type TokenContext,
} from "#v1/certificate-token/handler"

const listApiKeys = spyOn(auth.api, "listApiKeys")
const createApiKey = spyOn(auth.api, "createApiKey")
const deleteApiKey = spyOn(auth.api, "deleteApiKey")
const readModule = spyOn(moduleFiles, "read")

const moduleFile = { bytes: new Uint8Array([0x7f, 0x45]), sha256: "abc123" }

async function startConnection(name: string) {
  fakeDb.queue(
    "query.user.findFirst",
    userRow({ id: "user-id", twoFactorEnabled: true })
  )
  return certificateTokenHandler.startConnection({
    context: userContext(),
    input: { name },
  })
}

const TOTP_SECRET = "plugin-generated-secret-0123456789"
const CERT_A = "00000000-0000-4000-8000-0000000000a1"
const CERT_B = "00000000-0000-4000-8000-0000000000b1"
const CERT_C = "00000000-0000-4000-8000-0000000000c1"
const CERT_D = "00000000-0000-4000-8000-0000000000d1"
const DAY_MS = 24 * 60 * 60 * 1000

// Windows, spent steps and lockouts live in memory for the whole run, so
// each test uses its own user and key.
let counter = 0
function tokenContext(): TokenContext {
  counter++
  return {
    ...anonymousContext(),
    headers: new Headers({ "x-forwarded-for": "192.168.1.20" }),
    token: {
      userId: `token-user-${counter}`,
      keyId: `token-key-${counter}`,
      keyName: "Firefox portátil",
    },
  }
}

function scope(id: string): VaultScope {
  return { kind: "certificate", id }
}

/** A certificate row whose sealed columns hold the RSA fixture. */
async function sealedRow(
  id: string,
  userId: string,
  options: { remember: boolean; overrides?: Partial<CertificateRow> }
) {
  const dataKey = vault.newDataKey()
  const encryptedPassword = await sealedPassword(id, dataKey, options.remember)
  return certificateRow({
    id,
    userId,
    alias: `Cert ${id.slice(-2)}`,
    encryptedDataKey: await vault.wrapDataKey(scope(id), dataKey),
    encryptedP12: await vault.seal(
      dataKey,
      scope(id),
      "p12",
      await p12Fixture("rsa")
    ),
    encryptedPassword,
    notBefore: new Date(Date.now() - DAY_MS),
    notAfter: new Date(Date.now() + 365 * DAY_MS),
    ...options.overrides,
  })
}

async function sealedPassword(
  id: string,
  dataKey: Uint8Array<ArrayBuffer>,
  remember: boolean
) {
  if (!remember) return null
  return vault.seal(
    dataKey,
    scope(id),
    "password",
    new TextEncoder().encode(P12_PASSWORD)
  )
}

async function twoFactorRow(userId: string) {
  return {
    id: `two-factor-${userId}`,
    userId,
    secret: await encryptTwoFactorSecret(TOTP_SECRET),
    backupCodes: "sealed-backup-codes",
    verified: true,
    failedVerificationCount: 0,
    lockedUntil: null,
  }
}

function tokenKey(id: string, createdAt: string) {
  return listedApiKey({
    id,
    name: `Browser ${id}`,
    createdAt: new Date(createdAt),
    lastRequest: new Date("2026-01-03T09:00:00.000Z"),
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    permissions: { certificateToken: ["use"] },
  })
}

beforeEach(() => fakeDb.reset())

afterEach(() => {
  listApiKeys.mockReset()
  createApiKey.mockReset()
  deleteApiKey.mockReset()
  readModule.mockReset()
})

describe("certificateToken.startConnection", () => {
  test("refuses a user without two-factor with CONFLICT", async () => {
    fakeDb.queue("query.user.findFirst", userRow({ id: "user-id" }))

    await expectErrorCode(
      certificateTokenHandler.startConnection({
        context: userContext(),
        input: { name: "Firefox portátil" },
      }),
      "CONFLICT"
    )
  })

  test("answers a code, the command with it and its expiry", async () => {
    const pending = await startConnection("Firefox portátil")

    expect(pending.code).toMatch(/^[0-9A-Z]{8}$/)
    expect(pending.displayCode).toBe(
      `${pending.code.slice(0, 4)}-${pending.code.slice(4)}`
    )
    expect(pending.command).toBe(
      `curl -fsSL 'http://localhost:4321/api/v1/certificateToken/installScript?code=${pending.code}' | sh`
    )
    const minutes = (Date.parse(pending.expiresAt) - Date.now()) / 60_000
    expect(minutes).toBeGreaterThan(9.9)
    expect(minutes).toBeLessThanOrEqual(10)
    expect(createApiKey).not.toHaveBeenCalled()
  })
})

describe("certificateToken.redeem", () => {
  test("creates the token key for the starter and returns url, key and hash", async () => {
    const { code } = await startConnection("Firefox portátil")
    readModule.mockResolvedValue(moduleFile)
    fakeDb.queue(
      "query.user.findFirst",
      userRow({ id: "user-id", twoFactorEnabled: true })
    )
    createApiKey.mockResolvedValue({
      ...tokenKey("key-new", "2026-01-01T10:00:00.000Z"),
      key: "sk_token_value",
    })

    const redeemed = await certificateTokenHandler.redeem({
      input: { code, arch: "x86_64" },
    })

    expect(createApiKey).toHaveBeenCalledWith({
      body: {
        configId: "default",
        userId: "user-id",
        name: "Firefox portátil",
        expiresIn: 365 * 24 * 60 * 60,
        permissions: { certificateToken: ["use"] },
        rateLimitEnabled: false,
      },
    })
    expect(redeemed).toEqual({
      url: "http://localhost:4321",
      key: "sk_token_value",
      moduleSha256: "abc123",
    })
    expect(
      await certificateTokenHandler.connectionStatus({
        context: userContext(),
        input: { code },
      })
    ).toEqual({ state: "connected", keyId: "key-new" })
  })

  test("refuses a second redeem without creating another key", async () => {
    const { code } = await startConnection("Firefox portátil")
    readModule.mockResolvedValue(moduleFile)
    fakeDb.queue(
      "query.user.findFirst",
      userRow({ id: "user-id", twoFactorEnabled: true })
    )
    createApiKey.mockResolvedValue({
      ...tokenKey("key-new", "2026-01-01T10:00:00.000Z"),
      key: "sk_token_value",
    })
    await certificateTokenHandler.redeem({ input: { code, arch: "x86_64" } })

    await expectErrorCode(
      certificateTokenHandler.redeem({ input: { code, arch: "x86_64" } }),
      "NOT_FOUND"
    )
    expect(createApiKey).toHaveBeenCalledTimes(1)
  })

  test("refuses an unknown code", async () => {
    readModule.mockResolvedValue(moduleFile)

    await expectErrorCode(
      certificateTokenHandler.redeem({
        input: { code: "00000000", arch: "x86_64" },
      }),
      "NOT_FOUND"
    )
    expect(createApiKey).not.toHaveBeenCalled()
  })

  test("keeps the code when the architecture is not shipped", async () => {
    const { code } = await startConnection("Firefox portátil")
    readModule.mockResolvedValue(null)

    await expectErrorCode(
      certificateTokenHandler.redeem({ input: { code, arch: "aarch64" } }),
      "NOT_FOUND"
    )
    expect(
      await certificateTokenHandler.connectionStatus({
        context: userContext(),
        input: { code },
      })
    ).toMatchObject({ state: "pending" })
  })

  test("gives the code back when the key cannot be created", async () => {
    const { code } = await startConnection("Firefox portátil")
    readModule.mockResolvedValue(moduleFile)
    fakeDb.queue("query.user.findFirst", userRow({ id: "user-id" }))

    await expectErrorCode(
      certificateTokenHandler.redeem({ input: { code, arch: "x86_64" } }),
      "CONFLICT"
    )
    expect(createApiKey).not.toHaveBeenCalled()
    expect(installCodes.peek(code)).not.toBeNull()
  })
})

describe("certificateToken.connectionStatus", () => {
  test("is pending with its expiry until the code is redeemed", async () => {
    const { code, expiresAt } = await startConnection("Firefox portátil")

    expect(
      await certificateTokenHandler.connectionStatus({
        context: userContext(),
        input: { code },
      })
    ).toEqual({ state: "pending", expiresAt })
  })

  test("answers NOT_FOUND for another user's connection", async () => {
    const { code } = await startConnection("Firefox portátil")

    await expectErrorCode(
      certificateTokenHandler.connectionStatus({
        context: adminContext(),
        input: { code },
      }),
      "NOT_FOUND"
    )
  })
})

describe("certificateToken.installScript", () => {
  test("builds the script with the address and the code", async () => {
    const { code } = await startConnection("Firefox portátil")

    const file = await certificateTokenHandler.installScript({
      input: { code },
    })
    const script = await file.text()

    expect(file.type).toBe("text/x-shellscript")
    expect(script).toContain("GARABATO_URL='http://localhost:4321'")
    expect(script).toContain(`INSTALL_CODE='${code}'`)
  })

  test("answers the expired script for an unknown code", async () => {
    const file = await certificateTokenHandler.installScript({
      input: { code: "'; rm -rf ~" },
    })

    const script = await file.text()
    expect(script).toContain("ha caducado")
    expect(script).not.toContain("rm -rf")
  })
})

describe("certificateToken.module", () => {
  test("answers the module file", async () => {
    readModule.mockResolvedValue(moduleFile)

    const file = await certificateTokenHandler.module({
      input: { arch: "aarch64" },
    })

    expect(readModule).toHaveBeenCalledWith("aarch64")
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(moduleFile.bytes)
  })

  test("answers NOT_FOUND for an unknown architecture", async () => {
    await expectErrorCode(
      certificateTokenHandler.module({ input: { arch: "riscv64" } }),
      "NOT_FOUND"
    )
    expect(readModule).not.toHaveBeenCalled()
  })

  test("answers NOT_FOUND when the file is not shipped", async () => {
    readModule.mockResolvedValue(null)

    await expectErrorCode(
      certificateTokenHandler.module({ input: { arch: "x86_64" } }),
      "NOT_FOUND"
    )
  })
})

describe("certificateToken.listKeys", () => {
  test("lists only token keys, newest first, without values", async () => {
    listApiKeys.mockResolvedValue(
      listedApiKeys([
        tokenKey("old", "2026-01-01T10:00:00.000Z"),
        listedApiKey({ id: "ordinary" }),
        tokenKey("new", "2026-01-02T10:00:00.000Z"),
      ])
    )

    const keys = await certificateTokenHandler.listKeys({
      context: userContext(),
    })

    expect(keys.map((key) => key.id)).toEqual(["new", "old"])
    expect(keys[0]).not.toHaveProperty("key")
  })
})

describe("certificateToken.revokeKey", () => {
  test("answers NOT_FOUND for a key that is not the caller's token key", async () => {
    listApiKeys.mockResolvedValue(
      listedApiKeys([listedApiKey({ id: "ordinary" })])
    )

    await expectErrorCode(
      certificateTokenHandler.revokeKey({
        context: userContext(),
        input: { id: "ordinary" },
      }),
      "NOT_FOUND"
    )
    expect(deleteApiKey).not.toHaveBeenCalled()
  })

  test("revokes the key and closes its window", async () => {
    listApiKeys.mockResolvedValue(
      listedApiKeys([tokenKey("revoked-key", "2026-01-01T10:00:00.000Z")])
    )
    deleteApiKey.mockResolvedValue({ success: true })
    tokenWindows.open("revoked-key")

    const result = await certificateTokenHandler.revokeKey({
      context: userContext(),
      input: { id: "revoked-key" },
    })

    expect(result).toEqual({ id: "revoked-key", success: true })
    expect(deleteApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ body: { keyId: "revoked-key" } })
    )
    expect(tokenWindows.isOpen("revoked-key")).toBe(false)
  })
})

describe("certificateToken.certificates", () => {
  test("offers only valid certificates with a remembered password", async () => {
    const context = tokenContext()
    const userId = context.token.userId
    fakeDb.queue("query.certificates.findMany", [
      await sealedRow(CERT_A, userId, { remember: true }),
      await sealedRow(CERT_B, userId, { remember: false }),
      await sealedRow(CERT_C, userId, {
        remember: true,
        overrides: { notAfter: new Date(Date.now() - DAY_MS) },
      }),
      await sealedRow(CERT_D, userId, {
        remember: true,
        overrides: { deletedAt: new Date() },
      }),
    ])

    const offered = await certificateTokenHandler.certificates({ context })

    expect(offered.map((certificate) => certificate.id)).toEqual([CERT_A])
    const [first] = offered
    if (!first) throw new Error("no certificate offered")
    expect(first).toMatchObject({
      alias: "Cert a1",
      holder: "ESPAÑOL PÉREZ JUAN - 12345678Z",
    })
    const der = Buffer.from(first.certificate, "base64")
    expect(new X509Certificate(der).subject).toContain("12345678Z")
  })

  test("leaves EC certificates out", async () => {
    const context = tokenContext()
    fakeDb.queue("query.certificates.findMany", [
      await sealedRow(CERT_A, context.token.userId, {
        remember: true,
        overrides: { keyAlgorithm: "EC" },
      }),
    ])

    expect(await certificateTokenHandler.certificates({ context })).toEqual([])
  })
})

describe("certificateToken.unlock", () => {
  async function unlock(context: TokenContext, code: string) {
    fakeDb.queue(
      "query.twoFactor.findFirst",
      await twoFactorRow(context.token.userId)
    )
    return certificateTokenHandler.unlock({ context, input: { code } })
  }

  test("opens the key's window for 15 minutes with the current code", async () => {
    const context = tokenContext()

    const { expiresAt } = await unlock(context, totpAt(TOTP_SECRET, Date.now()))

    const minutes = (Date.parse(expiresAt) - Date.now()) / 60_000
    expect(minutes).toBeGreaterThan(14.9)
    expect(minutes).toBeLessThanOrEqual(15)
    expect(tokenWindows.isOpen(context.token.keyId)).toBe(true)
  })

  test("rejects a wrong code with BAD_REQUEST and keeps the window closed", async () => {
    const context = tokenContext()

    await expectErrorCode(unlock(context, "000000"), "BAD_REQUEST")
    expect(tokenWindows.isOpen(context.token.keyId)).toBe(false)
  })

  test("rejects a code that already opened a window", async () => {
    const context = tokenContext()
    const code = totpAt(TOTP_SECRET, Date.now())
    await unlock(context, code)
    tokenWindows.close(context.token.keyId)

    await expectErrorCode(unlock(context, code), "BAD_REQUEST")
    expect(tokenWindows.isOpen(context.token.keyId)).toBe(false)
  })

  test("refuses even the right code after 5 wrong ones", async () => {
    const context = tokenContext()
    for (let i = 0; i < 5; i++) {
      await expectErrorCode(unlock(context, "000000"), "BAD_REQUEST")
    }

    await expectErrorCode(
      certificateTokenHandler.unlock({
        context,
        input: { code: totpAt(TOTP_SECRET, Date.now()) },
      }),
      "TOO_MANY_REQUESTS"
    )
    expect(tokenWindows.isOpen(context.token.keyId)).toBe(false)
  })

  test("opens only the key that unlocked", async () => {
    const context = tokenContext()

    await unlock(context, totpAt(TOTP_SECRET, Date.now()))

    expect(tokenWindows.isOpen(`${context.token.keyId}-other`)).toBe(false)
  })

  test("refuses a user without a TOTP secret with FORBIDDEN", async () => {
    const context = tokenContext()
    fakeDb.queue("query.twoFactor.findFirst", undefined)

    await expectErrorCode(
      certificateTokenHandler.unlock({ context, input: { code: "123456" } }),
      "FORBIDDEN"
    )
  })
})

describe("certificateToken.lock", () => {
  test("closes the window at once and is idempotent", async () => {
    const context = tokenContext()
    tokenWindows.open(context.token.keyId)

    expect(await certificateTokenHandler.lock({ context })).toEqual({
      locked: true,
    })
    expect(await certificateTokenHandler.lock({ context })).toEqual({
      locked: true,
    })
    expect(tokenWindows.isOpen(context.token.keyId)).toBe(false)
  })
})

describe("certificateToken.sign", () => {
  async function openContext() {
    const context = tokenContext()
    tokenWindows.open(context.token.keyId)
    return context
  }

  async function publicKeyOf(context: TokenContext) {
    fakeDb.queue("query.certificates.findMany", [
      await sealedRow(CERT_A, context.token.userId, { remember: true }),
    ])
    const [offered] = await certificateTokenHandler.certificates({ context })
    if (!offered) throw new Error("no certificate offered")
    return new X509Certificate(Buffer.from(offered.certificate, "base64"))
      .publicKey
  }

  test("signs a TLS 1.3 RSA-PSS hash and traces it with the browser", async () => {
    const context = await openContext()
    const publicKey = await publicKeyOf(context)
    const message = randomBytes(100)
    const digest = createHash("sha256").update(message).digest()
    fakeDb.queue(
      "query.certificates.findFirst",
      await sealedRow(CERT_A, context.token.userId, { remember: true })
    )
    fakeDb.queue("insert", [])

    const { signature } = await certificateTokenHandler.sign({
      context,
      input: {
        certificateId: CERT_A,
        mechanism: { name: "rsa-pss", hash: "sha256", saltLength: 32 },
        data: digest.toString("base64"),
      },
    })

    expect(
      verify(
        "sha256",
        message,
        {
          key: publicKey,
          padding: constants.RSA_PKCS1_PSS_PADDING,
          saltLength: 32,
        },
        Buffer.from(signature, "base64")
      )
    ).toBe(true)
    const [insert] = fakeDb.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toEqual([
      {
        userId: context.token.userId,
        type: "certificate.usedToSignIn",
        documentId: undefined,
        certificateId: CERT_A,
        versionId: undefined,
        ipAddress: "192.168.1.20",
        details: {
          key: { id: context.token.keyId, name: "Firefox portátil" },
        },
      },
    ])
  })

  test("signs a TLS 1.2 PKCS#1 v1.5 DigestInfo", async () => {
    const context = await openContext()
    const publicKey = await publicKeyOf(context)
    const message = randomBytes(100)
    const digestInfo = Buffer.concat([
      Buffer.from("3031300d060960864801650304020105000420", "hex"),
      createHash("sha256").update(message).digest(),
    ])
    fakeDb.queue(
      "query.certificates.findFirst",
      await sealedRow(CERT_A, context.token.userId, { remember: true })
    )
    fakeDb.queue("insert", [])

    const { signature } = await certificateTokenHandler.sign({
      context,
      input: {
        certificateId: CERT_A,
        mechanism: { name: "rsa-pkcs1" },
        data: digestInfo.toString("base64"),
      },
    })

    expect(
      verify("sha256", message, publicKey, Buffer.from(signature, "base64"))
    ).toBe(true)
  })

  test("refuses with FORBIDDEN while the window is closed", async () => {
    const context = tokenContext()

    await expectErrorCode(
      certificateTokenHandler.sign({
        context,
        input: {
          certificateId: CERT_A,
          mechanism: { name: "rsa-pkcs1" },
          data: "AAAA",
        },
      }),
      "FORBIDDEN"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("answers NOT_FOUND for a certificate the token does not offer", async () => {
    const context = await openContext()
    fakeDb.queue(
      "query.certificates.findFirst",
      await sealedRow(CERT_B, context.token.userId, { remember: false })
    )

    await expectErrorCode(
      certificateTokenHandler.sign({
        context,
        input: {
          certificateId: CERT_B,
          mechanism: { name: "rsa-pkcs1" },
          data: "AAAA",
        },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("answers NOT_FOUND for another user's certificate", async () => {
    const context = await openContext()
    fakeDb.queue("query.certificates.findFirst", undefined)

    await expectErrorCode(
      certificateTokenHandler.sign({
        context,
        input: {
          certificateId: CERT_A,
          mechanism: { name: "rsa-pkcs1" },
          data: "AAAA",
        },
      }),
      "NOT_FOUND"
    )
  })

  test("rejects a hash of the wrong length with BAD_REQUEST and traces nothing", async () => {
    const context = await openContext()
    fakeDb.queue(
      "query.certificates.findFirst",
      await sealedRow(CERT_A, context.token.userId, { remember: true })
    )

    await expectErrorCode(
      certificateTokenHandler.sign({
        context,
        input: {
          certificateId: CERT_A,
          mechanism: { name: "rsa-pss", hash: "sha256", saltLength: 32 },
          data: randomBytes(20).toString("base64"),
        },
      }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })
})
