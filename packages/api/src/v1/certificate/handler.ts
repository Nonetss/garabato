import { db } from "@nonete/db"
import { type Certificate, certificates } from "@nonete/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { requireUserId } from "#shared/caller"
import {
  certificateScope,
  openCertificateFile,
  rejectPkcs12,
} from "#shared/certificate-secrets"
import { toIso } from "#shared/dates"
import { isUniqueViolation } from "#shared/db-errors"
import { assertFound } from "#shared/not-found"
import { type CertificateMetadata, readPkcs12 } from "#shared/pkcs12"
import { vault } from "#shared/vault"
import type { certificateInput } from "#v1/certificate/input"
import type { CertificateSummary } from "#v1/certificate/output"

const EXPIRING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const NOT_FOUND_MESSAGE = "Certificado no encontrado"

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
    rejectPkcs12(error)
  }
}

function aliasFor(alias: string | undefined, metadata: CertificateMetadata) {
  if (alias !== undefined) return alias
  return metadata.commonName
}

function encode(password: string) {
  return new TextEncoder().encode(password)
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
      ? await vault.seal(
          dataKey,
          certificateScope(id),
          "password",
          encode(input.password)
        )
      : null

    try {
      const [row] = await db
        .insert(certificates)
        .values({
          id,
          userId,
          alias: aliasFor(input.alias, metadata),
          ...metadata,
          encryptedDataKey: await vault.wrapDataKey(
            certificateScope(id),
            dataKey
          ),
          encryptedP12: await vault.seal(
            dataKey,
            certificateScope(id),
            "p12",
            bytes
          ),
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
    const { dataKey, p12 } = await openCertificateFile(current)
    readOrReject(p12, input.password)

    const row = await updateOwned(userId, input.id, {
      encryptedPassword: await vault.seal(
        dataKey,
        certificateScope(current.id),
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
