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
  type BrowserTokenSettingsRow,
  browserTokenSettingsRow,
  type CertificateRow,
  certificateRow,
  stepArgs,
  userRow,
} from "@nonete/db/testing"
import { installCodes } from "#shared/install-codes"
import { MODULE_VERSION, moduleFiles } from "#shared/token-module"
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
      module: { version: "0.2.0", platform: "linux-x86_64" },
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

// Installs are allowed unless a test says otherwise: each install procedure
// reads the switches once, and an unconsumed result is harmless.
function allowInstalls() {
  for (let i = 0; i < 4; i++) {
    fakeDb.queue("query.browserTokenSettings.findFirst", undefined)
  }
}

function switchesOff(overrides: Partial<BrowserTokenSettingsRow>) {
  fakeDb.reset()
  fakeDb.queue(
    "query.browserTokenSettings.findFirst",
    browserTokenSettingsRow(overrides)
  )
}

// What the install script's request looks like: no session, a client IP.
function scriptContext() {
  return {
    ...anonymousContext(),
    headers: new Headers({ "x-forwarded-for": "198.51.100.4" }),
  }
}

// Every browser token action writes a trace; most tests do not look at it.
function allowTraces() {
  for (let i = 0; i < 8; i++) fakeDb.queue("insert", [])
}

// A written trace as [type, details], for comparing several in order.
function typeAndDetails(value: unknown) {
  if (typeof value !== "object" || value === null) return [null, null]
  if (!("type" in value) || !("details" in value)) return [null, null]
  return [value.type, value.details]
}

function tracesWritten() {
  return fakeDb.calls("insert").flatMap((call) => stepArgs(call, "values")[0])
}

beforeEach(() => {
  fakeDb.reset()
  allowInstalls()
  allowTraces()
})

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
    expect(pending.commands).toEqual({
      linux: `curl -fsSL 'http://localhost:4321/api/v1/certificateToken/installScript?code=${pending.code}' | sh`,
      windows: `irm 'http://localhost:4321/api/v1/certificateToken/installScript?code=${pending.code}&os=windows' | iex`,
    })
    const minutes = (Date.parse(pending.expiresAt) - Date.now()) / 60_000
    expect(minutes).toBeGreaterThan(9.9)
    expect(minutes).toBeLessThanOrEqual(10)
    expect(createApiKey).not.toHaveBeenCalled()
  })
})

describe("emergency switches on installs", () => {
  test("startConnection is refused while installs are off", async () => {
    switchesOff({ installsEnabled: false })

    await expectErrorCode(
      certificateTokenHandler.startConnection({
        context: userContext(),
        input: { name: "Firefox portátil" },
      }),
      "SERVICE_UNAVAILABLE"
    )
  })

  test("redeem is refused while the token is off, keeping the code", async () => {
    const { code } = await startConnection("Firefox portátil")
    switchesOff({ tokenEnabled: false })

    await expectErrorCode(
      certificateTokenHandler.redeem({
        context: scriptContext(),
        input: { code, arch: "x86_64", os: "linux" },
      }),
      "SERVICE_UNAVAILABLE"
    )
    expect(createApiKey).not.toHaveBeenCalled()
    expect(installCodes.peek(code)).not.toBeNull()
  })

  test("the install script only says installs are off", async () => {
    const { code } = await startConnection("Firefox portátil")
    switchesOff({ installsEnabled: false })

    const file = await certificateTokenHandler.installScript({
      input: { code, os: "windows" },
    })
    const script = await file.text()

    expect(script).toContain("desactivada temporalmente")
    expect(script).not.toContain("Invoke-")
  })

  test("the module download is refused while installs are off", async () => {
    switchesOff({ installsEnabled: false })

    await expectErrorCode(
      certificateTokenHandler.module({ input: { arch: "x86_64" } }),
      "SERVICE_UNAVAILABLE"
    )
    expect(readModule).not.toHaveBeenCalled()
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
      context: scriptContext(),
      input: { code, arch: "x86_64", os: "linux" },
    })

    expect(createApiKey).toHaveBeenCalledWith({
      body: {
        configId: "default",
        userId: "user-id",
        name: "Firefox portátil",
        expiresIn: 365 * 24 * 60 * 60,
        permissions: { certificateToken: ["use"] },
        rateLimitEnabled: false,
        metadata: { moduleVersion: MODULE_VERSION, platform: "linux-x86_64" },
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

  test("hashes the module of the operating system the script names", async () => {
    const { code } = await startConnection("Firefox oficina")
    readModule.mockResolvedValue({ ...moduleFile, sha256: "dll-hash" })
    fakeDb.queue(
      "query.user.findFirst",
      userRow({ id: "user-id", twoFactorEnabled: true })
    )
    createApiKey.mockResolvedValue({
      ...tokenKey("key-win", "2026-01-01T10:00:00.000Z"),
      key: "sk_token_value",
    })

    const redeemed = await certificateTokenHandler.redeem({
      context: scriptContext(),
      input: { code, arch: "x86_64", os: "windows" },
    })

    expect(readModule).toHaveBeenCalledWith("windows", "x86_64")
    expect(redeemed.moduleSha256).toBe("dll-hash")
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
    await certificateTokenHandler.redeem({
      context: scriptContext(),
      input: { code, arch: "x86_64", os: "linux" },
    })

    await expectErrorCode(
      certificateTokenHandler.redeem({
        context: scriptContext(),
        input: { code, arch: "x86_64", os: "linux" },
      }),
      "NOT_FOUND"
    )
    expect(createApiKey).toHaveBeenCalledTimes(1)
  })

  test("refuses an unknown code", async () => {
    readModule.mockResolvedValue(moduleFile)

    await expectErrorCode(
      certificateTokenHandler.redeem({
        context: scriptContext(),
        input: { code: "00000000", arch: "x86_64", os: "linux" },
      }),
      "NOT_FOUND"
    )
    expect(createApiKey).not.toHaveBeenCalled()
  })

  test("keeps the code when the architecture is not shipped", async () => {
    const { code } = await startConnection("Firefox portátil")
    readModule.mockResolvedValue(null)

    await expectErrorCode(
      certificateTokenHandler.redeem({
        context: scriptContext(),
        input: { code, arch: "aarch64", os: "linux" },
      }),
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
      certificateTokenHandler.redeem({
        context: scriptContext(),
        input: { code, arch: "x86_64", os: "linux" },
      }),
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
      input: { code, os: "linux" },
    })
    const script = await file.text()

    expect(file.type).toBe("text/plain; charset=utf-8")
    expect(script).toContain("GARABATO_URL='http://localhost:4321'")
    expect(script).toContain(`INSTALL_CODE='${code}'`)
  })

  test("builds the PowerShell script for Windows", async () => {
    const { code } = await startConnection("Firefox oficina")

    const file = await certificateTokenHandler.installScript({
      input: { code, os: "windows" },
    })
    const script = await file.text()

    expect(file.name).toBe("garabato-install.ps1")
    expect(script).toContain("$GarabatoUrl = 'http://localhost:4321'")
    expect(script).toContain(`$InstallCode = '${code}'`)
  })

  test("answers the expired script for an unknown code", async () => {
    const file = await certificateTokenHandler.installScript({
      input: { code: "'; rm -rf ~", os: "linux" },
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

    expect(readModule).toHaveBeenCalledWith("linux", "aarch64")
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(moduleFile.bytes)
  })

  test("answers the Windows DLL", async () => {
    readModule.mockResolvedValue(moduleFile)

    const file = await certificateTokenHandler.module({
      input: { arch: "x86_64", os: "windows" },
    })

    expect(readModule).toHaveBeenCalledWith("windows", "x86_64")
    expect(file.name).toBe("garabato_pkcs11.dll")
  })

  test("answers NOT_FOUND for an unknown operating system", async () => {
    await expectErrorCode(
      certificateTokenHandler.module({
        input: { arch: "x86_64", os: "macos" },
      }),
      "NOT_FOUND"
    )
    expect(readModule).not.toHaveBeenCalled()
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
      certificateTokenHandler.module({
        input: { arch: "x86_64", os: "linux" },
      }),
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

describe("certificateToken.listKeys module versions", () => {
  test("marks browsers below the minimum version as outdated", async () => {
    switchesOff({ minModuleVersion: "0.2.0" })
    listApiKeys.mockResolvedValue(
      listedApiKeys([
        {
          ...tokenKey("new", "2026-01-02T10:00:00.000Z"),
          metadata: { moduleVersion: "0.2.0", platform: "windows-x86_64" },
        },
        tokenKey("legacy", "2026-01-01T10:00:00.000Z"),
      ])
    )

    const keys = await certificateTokenHandler.listKeys({
      context: userContext(),
    })

    expect(
      keys.map((key) => [key.id, key.moduleVersion, key.platform, key.outdated])
    ).toEqual([
      ["new", "0.2.0", "windows-x86_64", false],
      ["legacy", "0.1.0", "unknown", true],
    ])
  })
})

describe("certificateToken.switches and settings", () => {
  function jsonOrNull(value: unknown) {
    if (value === null) return null
    return JSON.stringify(value)
  }

  function apikeyRow(id: string, metadata: unknown, permissions: unknown) {
    return {
      id,
      permissions: JSON.stringify(permissions),
      metadata: jsonOrNull(metadata),
    }
  }

  test("switches tell the certificates page what applies", async () => {
    switchesOff({ installsEnabled: false })

    expect(await certificateTokenHandler.switches()).toEqual({
      tokenEnabled: true,
      installsEnabled: false,
      minModuleVersion: null,
      servedVersion: MODULE_VERSION,
    })
  })

  test("settings count connected browsers per version, ignoring other keys", async () => {
    fakeDb.reset()
    const row = {
      ...browserTokenSettingsRow({
        minModuleVersion: "0.2.0",
        updatedBy: "admin-id",
      }),
      updatedByUser: userRow({ id: "admin-id", name: "Admin" }),
    }
    fakeDb.queue("query.browserTokenSettings.findFirst", row, row)
    const token = { certificateToken: ["use"] }
    fakeDb.queue("query.apikey.findMany", [
      apikeyRow(
        "a",
        { moduleVersion: "0.2.0", platform: "linux-x86_64" },
        token
      ),
      apikeyRow(
        "b",
        { moduleVersion: "0.2.0", platform: "linux-x86_64" },
        token
      ),
      apikeyRow("c", null, token),
      apikeyRow("d", null, { other: ["use"] }),
    ])

    const settings = await certificateTokenHandler.settings()

    expect(settings).toMatchObject({
      minModuleVersion: "0.2.0",
      updatedBy: { id: "admin-id", name: "Admin" },
      browsers: [
        {
          version: "0.2.0",
          platform: "linux-x86_64",
          count: 2,
          outdated: false,
        },
        { version: "0.1.0", platform: "unknown", count: 1, outdated: true },
      ],
    })
  })

  test("updateSettings saves the switches with the administrator", async () => {
    fakeDb.reset()
    fakeDb.queue("query.browserTokenSettings.findFirst", undefined)
    fakeDb.queue("insert", [])
    const saved = browserTokenSettingsRow({
      tokenEnabled: false,
      updatedBy: "admin-id",
    })
    fakeDb.queue("query.browserTokenSettings.findFirst", saved, saved)
    fakeDb.queue("query.apikey.findMany", [])

    const result = await certificateTokenHandler.updateSettings({
      context: adminContext(),
      input: {
        tokenEnabled: false,
        installsEnabled: true,
        minModuleVersion: null,
      },
    })

    const [insert] = fakeDb.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toMatchObject({
      tokenEnabled: false,
      updatedBy: "admin-id",
    })
    expect(result.tokenEnabled).toBe(false)
  })
})

describe("browser token traces", () => {
  test("a redeemed code traces the connected browser with its platform and IP", async () => {
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

    await certificateTokenHandler.redeem({
      context: scriptContext(),
      input: { code, arch: "aarch64", os: "linux" },
    })

    expect(tracesWritten()).toContainEqual(
      expect.objectContaining({
        userId: "user-id",
        type: "browser.connected",
        ipAddress: "198.51.100.4",
        details: {
          key: { id: "key-new", name: "Firefox portátil" },
          platform: "linux-aarch64",
        },
      })
    )
  })

  test("a used command is traced for its owner, an unknown one is not", async () => {
    const { code } = await startConnection("Zen sobremesa")
    installCodes.redeem(code)
    readModule.mockResolvedValue(moduleFile)

    await expectErrorCode(
      certificateTokenHandler.redeem({
        context: scriptContext(),
        input: { code, arch: "x86_64", os: "linux" },
      }),
      "NOT_FOUND"
    )
    await expectErrorCode(
      certificateTokenHandler.redeem({
        context: scriptContext(),
        input: { code: "00000000", arch: "x86_64", os: "linux" },
      }),
      "NOT_FOUND"
    )

    expect(tracesWritten()).toEqual([
      expect.objectContaining({
        userId: "user-id",
        type: "browser.installRefused",
        details: { name: "Zen sobremesa", reason: "used" },
      }),
    ])
  })

  test("unlocking, a wrong code, the lockout and locking are traced", async () => {
    const context = tokenContext()
    const key = { id: context.token.keyId, name: "Firefox portátil" }
    const unlockWith = async (code: string) => {
      fakeDb.queue(
        "query.twoFactor.findFirst",
        await twoFactorRow(context.token.userId)
      )
      return certificateTokenHandler.unlock({ context, input: { code } })
    }

    await unlockWith(totpAt(TOTP_SECRET, Date.now()))
    await expectErrorCode(unlockWith("000000"), "BAD_REQUEST")
    for (let i = 0; i < 4; i++) {
      await expectErrorCode(unlockWith("000000"), "BAD_REQUEST")
    }
    await expectErrorCode(unlockWith("000000"), "TOO_MANY_REQUESTS")
    await certificateTokenHandler.lock({ context })

    const types = tracesWritten().map(typeAndDetails)
    expect(types[0]).toEqual(["browser.unlocked", { key }])
    expect(types[1]).toEqual([
      "browser.unlockFailed",
      { key, reason: "wrong-code" },
    ])
    expect(types[6]).toEqual([
      "browser.unlockFailed",
      { key, reason: "locked-out" },
    ])
    expect(types[7]).toEqual(["browser.locked", { key }])
  })

  test("disconnecting a browser is traced with its name", async () => {
    listApiKeys.mockResolvedValue(
      listedApiKeys([tokenKey("gone-key", "2026-01-01T10:00:00.000Z")])
    )
    deleteApiKey.mockResolvedValue({ success: true })

    await certificateTokenHandler.revokeKey({
      context: userContext(),
      input: { id: "gone-key" },
    })

    expect(tracesWritten()).toEqual([
      expect.objectContaining({
        type: "browser.disconnected",
        details: { key: { id: "gone-key", name: "Browser gone-key" } },
      }),
    ])
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
