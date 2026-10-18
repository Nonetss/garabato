import type { KeyObject } from "node:crypto"
import { auth } from "@nonete/auth"
import { decryptTwoFactorSecret } from "@nonete/auth/two-factor"
import { db } from "@nonete/db"
import type { Certificate } from "@nonete/db/schema"
import { env } from "@nonete/env/server"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { requireUserId } from "#shared/caller"
import {
  openCertificateFile,
  openRememberedPassword,
} from "#shared/certificate-secrets"
import { toIso, toIsoOrNull } from "#shared/dates"
import { formatInstallCode, installCodes } from "#shared/install-codes"
import { openRawSigningKey } from "#shared/pkcs12"
import {
  RawSignatureError,
  type RawSignatureMechanism,
  signRaw,
} from "#shared/raw-signature"
import {
  hasTokenPermission,
  TOKEN_KEY_PERMISSIONS,
  type TokenCaller,
  TWO_FACTOR_REQUIRED_MESSAGE,
} from "#shared/token-key"
import {
  expiredInstallScript,
  MODULE_ARCHITECTURES,
  type ModuleArchitecture,
  moduleFiles,
} from "#shared/token-module"
import { tokenWindows } from "#shared/token-window"
import { matchTotpStep } from "#shared/totp"
import { recordTraces } from "#shared/trace"
import type { certificateTokenInput } from "#v1/certificate-token/input"
import type { TokenKeySummary } from "#v1/certificate-token/output"

/** Context of a procedure reached with a token key (`tokenProcedure`). */
export type TokenContext = Context & { token: TokenCaller }

const KEY_LIFETIME_SECONDS = 365 * 24 * 60 * 60
const KEY_NOT_FOUND_MESSAGE = "Navegador no encontrado"

type KeyRecord = {
  id: string
  name: string | null
  createdAt: Date
  expiresAt: Date | null
  lastRequest: Date | null
}

function toSummary(key: KeyRecord): TokenKeySummary {
  return {
    id: key.id,
    name: key.name ?? "",
    createdAt: toIso(key.createdAt),
    expiresAt: toIsoOrNull(key.expiresAt),
    lastUsedAt: toIsoOrNull(key.lastRequest),
  }
}

async function ownTokenKeys(context: Context) {
  const { apiKeys } = await auth.api.listApiKeys({ headers: context.headers })
  return apiKeys.filter((key) => hasTokenPermission(key.permissions))
}

/**
 * Whether the browser token offers a certificate: not deleted, valid now,
 * with a remembered password (the token has no way to ask for it) and an RSA
 * key (the token signs RSA only).
 */
function offeredByToken(row: Certificate, now: Date) {
  return (
    row.deletedAt === null &&
    row.encryptedPassword !== null &&
    row.keyAlgorithm === "RSA" &&
    row.notBefore.getTime() <= now.getTime() &&
    row.notAfter.getTime() > now.getTime()
  )
}

/** Unseals a certificate the token offers and opens its key. */
async function openOffered(row: Certificate) {
  const { dataKey, p12 } = await openCertificateFile(row)
  const password = await openRememberedPassword(row, dataKey)
  if (password === null) {
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Offered certificate has no remembered password",
    })
  }
  return openRawSigningKey(p12, password)
}

/** Signs, or rejects data that does not fit the mechanism as `BAD_REQUEST`. */
function signOrReject(
  key: KeyObject,
  mechanism: RawSignatureMechanism,
  data: Uint8Array
) {
  try {
    return signRaw(key, mechanism, data)
  } catch (error) {
    if (error instanceof RawSignatureError) {
      throw errors.BAD_REQUEST({ message: error.message })
    }
    throw error
  }
}

/** Garabato's public address, as the browser and the install script use it. */
function publicUrl() {
  return env.CORS_ORIGIN.replace(/\/+$/, "")
}

function installCommand(code: string) {
  return `curl -fsSL '${publicUrl()}/api/v1/certificateToken/installScript?code=${code}' | sh`
}

function isArchitecture(value: string): value is ModuleArchitecture {
  return MODULE_ARCHITECTURES.some((arch) => arch === value)
}

async function requireTwoFactor(userId: string) {
  const owner = await db.query.user.findFirst({ where: { id: userId } })
  if (!owner?.twoFactorEnabled) {
    throw errors.CONFLICT({ message: TWO_FACTOR_REQUIRED_MESSAGE })
  }
}

// Server-side call (no headers): only then may a key carry permissions and
// skip the plugin's default rate limit, which the module would hit.
function createTokenKey(userId: string, name: string) {
  return auth.api.createApiKey({
    body: {
      configId: "default",
      userId,
      name,
      expiresIn: KEY_LIFETIME_SECONDS,
      permissions: TOKEN_KEY_PERMISSIONS,
      rateLimitEnabled: false,
    },
  })
}

const EXPIRED_CODE_MESSAGE =
  "El comando ha caducado o ya se usó; genera otro en Garabato"

function minutesUntil(date: Date) {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000))
}

export const certificateTokenHandler = {
  startConnection: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof certificateTokenInput.startConnection>
  }) => {
    const userId = requireUserId(context)
    await requireTwoFactor(userId)
    const pending = installCodes.start(userId, input.name)
    return {
      code: pending.code,
      displayCode: formatInstallCode(pending.code),
      command: installCommand(pending.code),
      expiresAt: toIso(new Date(pending.expiresAt)),
    }
  },

  connectionStatus: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof certificateTokenInput.connectionStatus>
  }) => {
    const state = installCodes.state(requireUserId(context), input.code)
    if (state === null) {
      throw errors.NOT_FOUND({ message: "Conexión no encontrada" })
    }
    if (state.state === "pending") {
      return { state: state.state, expiresAt: toIso(state.expiresAt) }
    }
    return state
  },

  redeem: async ({
    input,
  }: {
    input: z.infer<typeof certificateTokenInput.redeem>
  }) => {
    // The module must exist before the code is spent: the script downloads
    // it first, and a missing architecture should not burn the code.
    const module = await moduleFiles.read(input.arch)
    if (!module) {
      throw errors.NOT_FOUND({
        message: `Este Garabato no incluye el módulo para ${input.arch}`,
      })
    }
    const pending = installCodes.redeem(input.code)
    if (!pending) throw errors.NOT_FOUND({ message: EXPIRED_CODE_MESSAGE })
    try {
      await requireTwoFactor(pending.userId)
      const created = await createTokenKey(pending.userId, pending.name)
      installCodes.complete(pending.code, created.id)
      return { url: publicUrl(), key: created.key, moduleSha256: module.sha256 }
    } catch (error) {
      installCodes.release(pending.code)
      throw error
    }
  },

  installScript: async ({
    input,
  }: {
    input: z.infer<typeof certificateTokenInput.installScript>
  }) => {
    const pending = installCodes.peek(input.code)
    const script = pending
      ? await moduleFiles.installScript(publicUrl(), pending.code)
      : expiredInstallScript()
    return new File([script], "garabato-install.sh", {
      type: "text/x-shellscript",
    })
  },

  module: async ({
    input,
  }: {
    input: z.infer<typeof certificateTokenInput.module>
  }) => {
    const notShipped = errors.NOT_FOUND({
      message: "No hay módulo para esa arquitectura",
    })
    if (!isArchitecture(input.arch)) throw notShipped
    const module = await moduleFiles.read(input.arch)
    if (!module) throw notShipped
    return new File([module.bytes], "libgarabato_pkcs11.so", {
      type: "application/octet-stream",
    })
  },

  listKeys: async ({ context }: { context: Context }) => {
    const keys = await ownTokenKeys(context)
    return keys
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toSummary)
  },

  revokeKey: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof certificateTokenInput.revokeKey>
  }) => {
    const keys = await ownTokenKeys(context)
    if (!keys.some((key) => key.id === input.id)) {
      throw errors.NOT_FOUND({ message: KEY_NOT_FOUND_MESSAGE })
    }
    const { success } = await auth.api.deleteApiKey({
      headers: context.headers,
      body: { keyId: input.id },
    })
    tokenWindows.close(input.id)
    return { id: input.id, success }
  },

  certificates: async ({ context }: { context: TokenContext }) => {
    const rows = await db.query.certificates.findMany({
      where: { userId: context.token.userId, deletedAt: { isNull: true } },
      orderBy: { alias: "asc" },
    })
    const now = new Date()
    const offered = rows.filter((row) => offeredByToken(row, now))
    const listed = []
    for (const row of offered) {
      const { certificate } = await openOffered(row)
      listed.push({
        id: row.id,
        alias: row.alias,
        holder: row.commonName,
        certificate: Buffer.from(certificate).toString("base64"),
      })
    }
    return listed
  },

  unlock: async ({
    context,
    input,
  }: {
    context: TokenContext
    input: z.infer<typeof certificateTokenInput.unlock>
  }) => {
    const { userId, keyId } = context.token
    const lockedUntil = tokenWindows.lockedUntil(userId)
    if (lockedUntil) {
      throw errors.TOO_MANY_REQUESTS({
        message: `Demasiados códigos incorrectos. Vuelve a intentarlo dentro de ${minutesUntil(lockedUntil)} minutos`,
      })
    }
    const twoFactor = await db.query.twoFactor.findFirst({
      where: { userId },
    })
    if (!twoFactor) {
      throw errors.FORBIDDEN({ message: TWO_FACTOR_REQUIRED_MESSAGE })
    }
    const secret = await decryptTwoFactorSecret(twoFactor.secret)
    const step = matchTotpStep(secret, input.code, Date.now())
    if (step === null || !tokenWindows.spendStep(userId, step)) {
      tokenWindows.recordFailure(userId)
      throw errors.BAD_REQUEST({ message: "Código incorrecto" })
    }
    tokenWindows.clearFailures(userId)
    return { expiresAt: toIso(tokenWindows.open(keyId)) }
  },

  lock: async ({ context }: { context: TokenContext }) => {
    tokenWindows.close(context.token.keyId)
    return { locked: true }
  },

  sign: async ({
    context,
    input,
  }: {
    context: TokenContext
    input: z.infer<typeof certificateTokenInput.sign>
  }) => {
    const { userId, keyId, keyName } = context.token
    if (!tokenWindows.isOpen(keyId)) {
      throw errors.FORBIDDEN({
        message: "El navegador está bloqueado; introduce un código nuevo",
      })
    }
    const row = await db.query.certificates.findFirst({
      where: { id: input.certificateId, userId, deletedAt: { isNull: true } },
    })
    if (!row || !offeredByToken(row, new Date())) {
      throw errors.NOT_FOUND({ message: "Certificado no encontrado" })
    }
    const { key } = await openOffered(row)
    const data = new Uint8Array(Buffer.from(input.data, "base64"))
    const signature = signOrReject(key, input.mechanism, data)
    await recordTraces(db, context, userId, [
      {
        type: "certificate.usedToSignIn",
        certificateId: row.id,
        details: { key: { id: keyId, name: keyName } },
      },
    ])
    return { signature: Buffer.from(signature).toString("base64") }
  },
}
