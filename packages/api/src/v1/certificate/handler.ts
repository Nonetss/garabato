import { db } from "@nonete/db"
import { type Certificate, certificates } from "@nonete/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { toIso } from "#shared/dates"
import { assertFound } from "#shared/not-found"
import type { certificateInput } from "#v1/certificate/input"
import type { CertificateSummary } from "#v1/certificate/output"
import {
  type CertificateMetadata,
  Pkcs12Error,
  type Pkcs12FailureKind,
  readPkcs12,
} from "#v1/certificate/pkcs12"
import { VaultError, vault } from "#v1/certificate/vault"

const EXPIRING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const NOT_FOUND_MESSAGE = "Certificado no encontrado"

const PKCS12_MESSAGES = {
  "wrong-password": "La contraseña del certificado no es correcta",
  "invalid-file":
    "El archivo no es un certificado PKCS#12 (.p12 o .pfx) válido",
  "no-key": "El archivo no contiene la clave privada del certificado",
  "several-keys":
    "El archivo contiene más de una clave privada; exporta solo el certificado que quieras usar",
  "no-matching-certificate":
    "La clave privada del archivo no corresponde a ningún certificado incluido",
  "unsupported-key":
    "El tipo de clave del certificado no está soportado (solo RSA y EC)",
  "not-for-signing": "Este certificado no permite firmar documentos",
} satisfies Record<Pkcs12FailureKind, string>

function requireUserId(context: Context) {
  if (!context.user) throw errors.UNAUTHORIZED()
  return context.user.id
}

function statusOf(notAfter: Date, now: Date): CertificateSummary["status"] {
  const remaining = notAfter.getTime() - now.getTime()
  if (remaining <= 0) return "expired"
  if (remaining <= EXPIRING_WINDOW_MS) return "expiring"
  return "valid"
}

function toSummary(row: Certificate, now: Date): CertificateSummary {
  return {
    id: row.id,
    alias: row.alias,
    commonName: row.commonName,
    givenName: row.givenName,
    surname: row.surname,
    taxId: row.taxId,
    issuerCommonName: row.issuerCommonName,
    serialNumber: row.serialNumber,
    fingerprintSha256: row.fingerprintSha256,
    keyAlgorithm: row.keyAlgorithm,
    notBefore: toIso(row.notBefore),
    notAfter: toIso(row.notAfter),
    status: statusOf(row.notAfter, now),
    passwordRemembered: row.encryptedPassword !== null,
    createdAt: toIso(row.createdAt),
  }
}

function readOrReject(bytes: Uint8Array, password: string) {
  try {
    return readPkcs12(bytes, password)
  } catch (error) {
    if (error instanceof Pkcs12Error) {
      throw errors.BAD_REQUEST({ message: PKCS12_MESSAGES[error.kind] })
    }
    throw error
  }
}

function aliasFor(alias: string | undefined, metadata: CertificateMetadata) {
  if (alias !== undefined) return alias
  return metadata.commonName
}

function encode(password: string) {
  return new TextEncoder().encode(password)
}

// Matches PostgreSQL's unique_violation, raw or wrapped by Drizzle.
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  if ("code" in error && error.code === "23505") return true
  if ("cause" in error) return isUniqueViolation(error.cause)
  return false
}

function ownedActive(userId: string, id: string) {
  return and(
    eq(certificates.id, id),
    eq(certificates.userId, userId),
    isNull(certificates.deletedAt)
  )
}

async function loadOwned(userId: string, id: string) {
  const row = await db.query.certificates.findFirst({
    where: { id, userId, deletedAt: { isNull: true } },
  })
  return assertFound(row, NOT_FOUND_MESSAGE)
}

// Unwraps the row's data key and opens its PKCS#12 file. A row that is not
// deleted always holds both; failing to open them is a server fault.
async function openFile(row: Certificate) {
  if (!row.encryptedDataKey || !row.encryptedP12) {
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Active certificate has no sealed file",
    })
  }
  try {
    const dataKey = await vault.unwrapDataKey(row.id, row.encryptedDataKey)
    const p12 = await vault.open(dataKey, row.id, "p12", row.encryptedP12)
    return { dataKey, p12 }
  } catch (error) {
    if (error instanceof VaultError) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Stored certificate could not be decrypted",
      })
    }
    throw error
  }
}

async function updateOwned(
  userId: string,
  id: string,
  values: Partial<Certificate>
) {
  const [row] = await db
    .update(certificates)
    .set(values)
    .where(ownedActive(userId, id))
    .returning()
  return assertFound(row, NOT_FOUND_MESSAGE)
}

export const certificateHandler = {
  list: async ({ context }: { context: Context }) => {
    const userId = requireUserId(context)
    const rows = await db.query.certificates.findMany({
      where: { userId, deletedAt: { isNull: true } },
      orderBy: { createdAt: "desc" },
    })
    const now = new Date()
    return rows.map((row) => toSummary(row, now))
  },

  get: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof certificateInput.get>
  }) => {
    const row = await loadOwned(requireUserId(context), input.id)
    return toSummary(row, new Date())
  },

  import: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof certificateInput.import>
  }) => {
    const userId = requireUserId(context)
    const bytes = new Uint8Array(await input.file.arrayBuffer())
    const metadata = readOrReject(bytes, input.password)
    const now = new Date()
    if (metadata.notAfter.getTime() <= now.getTime()) {
      throw errors.BAD_REQUEST({ message: "El certificado está caducado" })
    }

    const duplicate = await db.query.certificates.findFirst({
      where: {
        userId,
        fingerprintSha256: metadata.fingerprintSha256,
        deletedAt: { isNull: true },
      },
    })
    if (duplicate) {
      throw errors.CONFLICT({ message: "Ya tienes este certificado" })
    }

    // The id is generated here because every sealed value is bound to it.
    const id = crypto.randomUUID()
    const dataKey = vault.newDataKey()
    const encryptedPassword = input.rememberPassword
      ? await vault.seal(dataKey, id, "password", encode(input.password))
      : null

    try {
      const [row] = await db
        .insert(certificates)
        .values({
          id,
          userId,
          alias: aliasFor(input.alias, metadata),
          ...metadata,
          encryptedDataKey: await vault.wrapDataKey(id, dataKey),
          encryptedP12: await vault.seal(dataKey, id, "p12", bytes),
          encryptedPassword,
        })
        .returning()
      if (!row) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Certificate insert returned no row",
        })
      }
      return toSummary(row, now)
    } catch (error) {
      // A concurrent import of the same certificate won the race.
      if (isUniqueViolation(error)) {
        throw errors.CONFLICT({ message: "Ya tienes este certificado" })
      }
      throw error
    }
  },

  rename: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof certificateInput.rename>
  }) => {
    const row = await updateOwned(requireUserId(context), input.id, {
      alias: input.alias,
    })
    return toSummary(row, new Date())
  },

  rememberPassword: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof certificateInput.rememberPassword>
  }) => {
    const userId = requireUserId(context)
    const current = await loadOwned(userId, input.id)
    const { dataKey, p12 } = await openFile(current)
    readOrReject(p12, input.password)

    const row = await updateOwned(userId, input.id, {
      encryptedPassword: await vault.seal(
        dataKey,
        current.id,
        "password",
        encode(input.password)
      ),
    })
    return toSummary(row, new Date())
  },

  forgetPassword: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof certificateInput.forgetPassword>
  }) => {
    const row = await updateOwned(requireUserId(context), input.id, {
      encryptedPassword: null,
    })
    return toSummary(row, new Date())
  },

  delete: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof certificateInput.delete>
  }) => {
    // Crypto-shredding: without its data key nothing sealed for this row can
    // ever be opened again. The metadata stays for future signature records.
    const row = await updateOwned(requireUserId(context), input.id, {
      encryptedDataKey: null,
      encryptedP12: null,
      encryptedPassword: null,
      deletedAt: new Date(),
    })
    return { id: row.id, success: true }
  },
}
