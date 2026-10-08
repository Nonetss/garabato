import { createHash } from "node:crypto"
import { EncryptedPDFError, PDFDocument } from "@cantoo/pdf-lib"
import { db } from "@nonete/db"
import { withKeysetPagination } from "@nonete/db/keyset-pagination"
import {
  type Certificate,
  certificates,
  type Document,
  type DocumentSignature,
  type DocumentVersion,
  documentSignatures,
  documents,
  documentVersions,
} from "@nonete/db/schema"
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  max,
  type SQL,
  sql,
} from "drizzle-orm"
import type { z } from "zod"

import { type Context, getRequestLogger } from "#context"
import { errors } from "#errors"
import { objectStorage } from "#lib/object-storage"
import { requireUserId } from "#shared/caller"
import {
  openCertificateFile,
  openRememberedPassword,
  rejectPkcs12,
} from "#shared/certificate-secrets"
import { toIso, toIsoOrNull } from "#shared/dates"
import { isUniqueViolation } from "#shared/db-errors"
import { assertFound } from "#shared/not-found"
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  paginateWithTotal,
} from "#shared/pagination"
import { openSigningKey } from "#shared/pkcs12"
import { likePattern } from "#shared/search"
import { VaultError, type VaultScope, vault } from "#shared/vault"
import type { documentInput } from "#v1/document/input"
import type {
  DocumentSummary,
  DocumentVersionOutput,
  SignatureLogRecord,
  SignatureRecord,
} from "#v1/document/output"
import { AppearanceError } from "#v1/document/pades/appearance"
import { EncryptedPdfError } from "#v1/document/pades/placeholder"
import { signPdf } from "#v1/document/pades/sign"

const NOT_FOUND_MESSAGE = "Documento no encontrado"
const CERTIFICATE_NOT_FOUND_MESSAGE = "Certificado no encontrado"
const CHANGED_MESSAGE =
  "El documento ha cambiado desde que lo abriste; recárgalo para firmar la última versión"

function documentScope(id: string): VaultScope {
  return { kind: "document", id }
}

function objectKeyFor(documentId: string, number: number) {
  return `documents/${documentId}/v${number}`
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

// No control characters, at most 200 characters, ending in `.pdf`.
export function pdfName(name: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, "").trim()
  if (clean === "") return "documento.pdf"
  if (/\.pdf$/i.test(clean)) return clean.slice(-200)
  return `${clean.slice(0, 196)}.pdf`
}

// An uploaded file's base name, without the client's directories.
export function documentName(fileName: string) {
  return pdfName(fileName.split(/[\\/]/).at(-1) ?? "")
}

// `contrato.pdf` for the current version, `contrato (v1).pdf` for older ones.
function downloadName(name: string, number: number, isCurrent: boolean) {
  if (isCurrent) return name
  return `${name.replace(/\.pdf$/i, "")} (v${number}).pdf`
}

// The first X-Forwarded-For entry: Caddy replaces any client-sent value.
function clientIp(context: Context) {
  const forwarded = context.headers.get("x-forwarded-for")
  if (!forwarded) return null
  const first = forwarded.split(",")[0]?.trim()
  if (!first) return null
  return first
}

async function loadPdf(bytes: Uint8Array) {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      throw errors.BAD_REQUEST({
        message:
          "El PDF está protegido con contraseña; sube una copia sin protección",
      })
    }
    throw errors.BAD_REQUEST({ message: "El archivo no es un PDF válido" })
  }
}

async function pageCountOf(bytes: Uint8Array) {
  const pdf = await loadPdf(bytes)
  const pageCount = pdf.getPageCount()
  if (pageCount === 0) {
    throw errors.BAD_REQUEST({ message: "El PDF no tiene páginas" })
  }
  return pageCount
}

function toVersion(row: DocumentVersion): DocumentVersionOutput {
  return {
    id: row.id,
    number: row.number,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    createdAt: toIso(row.createdAt),
  }
}

type SignatureJoin = {
  signature: DocumentSignature
  documentName: string
  documentDeletedAt: Date | null
  versionNumber: number
  certificateAlias: string
  certificateHolder: string
}

function toRecord(row: SignatureJoin): SignatureRecord {
  const { signature } = row
  return {
    id: signature.id,
    documentId: signature.documentId,
    documentName: row.documentName,
    documentDeleted: row.documentDeletedAt !== null,
    versionId: signature.versionId,
    versionNumber: row.versionNumber,
    certificateId: signature.certificateId,
    certificateAlias: row.certificateAlias,
    certificateHolder: row.certificateHolder,
    signedAt: toIso(signature.signedAt),
    visible: signature.visible,
    pages: signature.pages,
    rect: signature.rect,
    reason: signature.reason,
    location: signature.location,
    sha256Before: signature.sha256Before,
    sha256After: signature.sha256After,
    ipAddress: signature.ipAddress,
  }
}

type SignatureLogJoin = SignatureJoin & {
  certificateDeletedAt: Date | null
  certificateTaxId: string | null
  certificateIssuer: string
  certificateSerialNumber: string
  certificateFingerprint: string
  certificateNotBefore: Date
  certificateNotAfter: Date
}

function toLogRecord(row: SignatureLogJoin): SignatureLogRecord {
  return {
    ...toRecord(row),
    certificateDeleted: row.certificateDeletedAt !== null,
    certificateTaxId: row.certificateTaxId,
    certificateIssuer: row.certificateIssuer,
    certificateSerialNumber: row.certificateSerialNumber,
    certificateFingerprint: row.certificateFingerprint,
    certificateNotBefore: toIso(row.certificateNotBefore),
    certificateNotAfter: toIso(row.certificateNotAfter),
  }
}

function summaryOf(
  document: Document,
  versions: DocumentVersion[],
  records: SignatureRecord[]
): DocumentSummary {
  const current = versions.at(-1)
  return {
    id: document.id,
    name: document.name,
    pageCount: document.pageCount,
    sizeBytes: current?.sizeBytes ?? 0,
    versionCount: versions.length,
    signatureCount: records.length,
    lastSignedAt: records[0]?.signedAt ?? null,
    createdAt: toIso(document.createdAt),
    updatedAt: toIso(document.updatedAt),
  }
}

// The requested version, or the current (latest) one when none is asked.
function pickVersion(versions: DocumentVersion[], number: number | undefined) {
  if (number === undefined) return versions.at(-1)
  return versions.find((version) => version.number === number)
}

function ownedActive(userId: string, id: string) {
  return and(
    eq(documents.id, id),
    eq(documents.userId, userId),
    isNull(documents.deletedAt)
  )
}

async function loadOwned(userId: string, id: string) {
  const row = await db.query.documents.findFirst({
    where: { id, userId, deletedAt: { isNull: true } },
  })
  return assertFound(row, NOT_FOUND_MESSAGE)
}

async function versionsOf(documentId: string) {
  return db.query.documentVersions.findMany({
    where: { documentId },
    orderBy: { number: "asc" },
  })
}

function signatureJoin() {
  return db
    .select({
      signature: documentSignatures,
      documentName: documents.name,
      documentDeletedAt: documents.deletedAt,
      versionNumber: documentVersions.number,
      certificateAlias: certificates.alias,
      certificateHolder: certificates.commonName,
      certificateDeletedAt: certificates.deletedAt,
      certificateTaxId: certificates.taxId,
      certificateIssuer: certificates.issuerCommonName,
      certificateSerialNumber: certificates.serialNumber,
      certificateFingerprint: certificates.fingerprintSha256,
      certificateNotBefore: certificates.notBefore,
      certificateNotAfter: certificates.notAfter,
    })
    .from(documentSignatures)
    .innerJoin(documents, eq(documents.id, documentSignatures.documentId))
    .innerJoin(
      documentVersions,
      eq(documentVersions.id, documentSignatures.versionId)
    )
    .innerJoin(
      certificates,
      eq(certificates.id, documentSignatures.certificateId)
    )
}

async function signaturesOfDocument(userId: string, documentId: string) {
  const rows = await signatureJoin()
    .where(
      and(
        eq(documentSignatures.userId, userId),
        eq(documentSignatures.documentId, documentId)
      )
    )
    .orderBy(desc(documentSignatures.signedAt))
  return rows.map(toRecord)
}

// The certificate must be the caller's; deleted ones still have records.
async function assertOwnCertificate(userId: string, certificateId: string) {
  const certificate = await db.query.certificates.findFirst({
    where: { id: certificateId, userId },
  })
  assertFound(certificate, CERTIFICATE_NOT_FOUND_MESSAGE)
}

// The log's filters, without the cursor: shared by the page and its count.
function signatureLogFilters(
  userId: string,
  input: z.infer<typeof documentInput.signatureLog>
) {
  const filters: SQL[] = [eq(documentSignatures.userId, userId)]
  if (input.certificateId !== undefined) {
    filters.push(eq(documentSignatures.certificateId, input.certificateId))
  }
  if (input.query !== undefined) {
    filters.push(ilike(documents.name, likePattern(input.query)))
  }
  if (input.signedFrom !== undefined) {
    filters.push(gte(documentSignatures.signedAt, new Date(input.signedFrom)))
  }
  if (input.signedBefore !== undefined) {
    filters.push(lt(documentSignatures.signedAt, new Date(input.signedBefore)))
  }
  return filters
}

function nextCursorOf(hasMore: boolean, lastRow: SignatureLogJoin | undefined) {
  if (!hasMore || !lastRow) return null
  return encodeKeysetCursor(lastRow.signature.signedAt, lastRow.signature.id)
}

async function unwrapDocumentKey(document: Document) {
  if (!document.encryptedDataKey) {
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Active document has no data key",
    })
  }
  try {
    return await vault.unwrapDataKey(
      documentScope(document.id),
      document.encryptedDataKey
    )
  } catch (error) {
    if (error instanceof VaultError) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Document key could not be decrypted",
      })
    }
    throw error
  }
}

async function readVersion(
  document: Document,
  dataKey: Uint8Array<ArrayBuffer>,
  version: DocumentVersion
) {
  const sealed = await objectStorage.getObject(version.objectKey)
  try {
    return await vault.open(
      dataKey,
      documentScope(document.id),
      `v${version.number}`,
      sealed
    )
  } catch (error) {
    if (error instanceof VaultError) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Stored document version could not be decrypted",
      })
    }
    throw error
  }
}

// Stores sealed bytes first, then runs `commit`; when the commit fails the
// object is removed best-effort, so no row ever points at a missing object.
async function storeThenCommit<T>(
  context: Context,
  objectKey: string,
  sealed: Uint8Array<ArrayBuffer>,
  commit: () => Promise<T>
): Promise<T> {
  await objectStorage.putObject(objectKey, sealed)
  try {
    return await commit()
  } catch (error) {
    await objectStorage.deleteObject(objectKey).catch((cleanupError) => {
      getRequestLogger(context)?.warn(
        { err: cleanupError, objectKey },
        "Orphan document object left after a failed commit"
      )
    })
    throw error
  }
}

async function loadSigningCertificate(userId: string, id: string) {
  const row = await db.query.certificates.findFirst({
    where: { id, userId, deletedAt: { isNull: true } },
  })
  return assertFound(row, "Certificado no encontrado")
}

async function passwordFor(
  certificate: Certificate,
  dataKey: Uint8Array<ArrayBuffer>,
  typed: string | undefined
) {
  if (typed !== undefined) return typed
  const remembered = await openRememberedPassword(certificate, dataKey)
  if (remembered !== null) return remembered
  throw errors.BAD_REQUEST({
    message: "Escribe la contraseña del certificado para firmar",
  })
}

type SignInput = z.infer<typeof documentInput.sign>

function visibleAppearance(appearance: SignInput["appearance"]) {
  if (!appearance.visible) return undefined
  return {
    page: appearance.page,
    pages: appearance.pages,
    rect: appearance.rect,
  }
}

async function signVersion(
  pdf: Uint8Array,
  certificate: Certificate,
  input: SignInput,
  signingTime: Date
) {
  const { p12, dataKey } = await openCertificateFile(certificate)
  const password = await passwordFor(certificate, dataKey, input.password)
  const identity = await openSigningKey(p12, password).catch(rejectPkcs12)
  try {
    return await signPdf(pdf, {
      identity,
      signerName: identity.metadata.commonName,
      signingTime,
      reason: input.reason,
      location: input.location,
      appearance: visibleAppearance(input.appearance),
    })
  } catch (error) {
    if (error instanceof AppearanceError) {
      throw errors.BAD_REQUEST({
        message: "La posición de la firma no es válida para este documento",
      })
    }
    if (error instanceof EncryptedPdfError) {
      throw errors.BAD_REQUEST({
        message: "No se puede firmar un PDF protegido con contraseña",
      })
    }
    throw error
  }
}

export const documentHandler = {
  upload: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.upload>
  }) => {
    const userId = requireUserId(context)
    const bytes = new Uint8Array(await input.file.arrayBuffer())
    const pageCount = await pageCountOf(bytes)

    // The id is generated here because the stored objects are bound to it.
    const id = crypto.randomUUID()
    const scope = documentScope(id)
    const dataKey = vault.newDataKey()
    const objectKey = objectKeyFor(id, 1)
    const sealed = await vault.seal(dataKey, scope, "v1", bytes)
    const encryptedDataKey = await vault.wrapDataKey(scope, dataKey)

    const { document, version } = await storeThenCommit(
      context,
      objectKey,
      sealed,
      () =>
        db.transaction(async (tx) => {
          const [documentRow] = await tx
            .insert(documents)
            .values({
              id,
              userId,
              name: documentName(input.file.name),
              pageCount,
              encryptedDataKey,
            })
            .returning()
          const [versionRow] = await tx
            .insert(documentVersions)
            .values({
              documentId: id,
              number: 1,
              objectKey,
              sizeBytes: bytes.length,
              sha256: sha256(bytes),
              createdBy: userId,
            })
            .returning()
          if (!documentRow || !versionRow) {
            throw errors.INTERNAL_SERVER_ERROR({
              message: "Document insert returned no row",
            })
          }
          return { document: documentRow, version: versionRow }
        })
    )
    return summaryOf(document, [version], [])
  },

  list: async ({ context }: { context: Context }) => {
    const userId = requireUserId(context)
    const currentVersion = db
      .select({
        documentId: documentVersions.documentId,
        versionCount: sql<number>`count(*)::int`.as("version_count"),
        sizeBytes:
          sql<number>`(array_agg(${documentVersions.sizeBytes} order by ${documentVersions.number} desc))[1]`.as(
            "size_bytes"
          ),
      })
      .from(documentVersions)
      .groupBy(documentVersions.documentId)
      .as("current_version")
    const signatureStats = db
      .select({
        documentId: documentSignatures.documentId,
        signatureCount: sql<number>`count(*)::int`.as("signature_count"),
        lastSignedAt: max(documentSignatures.signedAt).as("last_signed_at"),
      })
      .from(documentSignatures)
      .groupBy(documentSignatures.documentId)
      .as("signature_stats")

    const rows = await db
      .select({
        document: documents,
        versionCount: currentVersion.versionCount,
        sizeBytes: currentVersion.sizeBytes,
        signatureCount: signatureStats.signatureCount,
        lastSignedAt: signatureStats.lastSignedAt,
      })
      .from(documents)
      .leftJoin(currentVersion, eq(currentVersion.documentId, documents.id))
      .leftJoin(signatureStats, eq(signatureStats.documentId, documents.id))
      .where(and(eq(documents.userId, userId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt))

    return rows.map(
      (row): DocumentSummary => ({
        id: row.document.id,
        name: row.document.name,
        pageCount: row.document.pageCount,
        sizeBytes: row.sizeBytes ?? 0,
        versionCount: row.versionCount ?? 0,
        signatureCount: row.signatureCount ?? 0,
        lastSignedAt: toIsoOrNull(row.lastSignedAt),
        createdAt: toIso(row.document.createdAt),
        updatedAt: toIso(row.document.updatedAt),
      })
    )
  },

  get: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.get>
  }) => {
    const userId = requireUserId(context)
    const document = await loadOwned(userId, input.id)
    const versions = await versionsOf(document.id)
    const records = await signaturesOfDocument(userId, document.id)
    return {
      ...summaryOf(document, versions, records),
      versions: versions.map(toVersion),
      signatures: records,
    }
  },

  download: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.download>
  }) => {
    const userId = requireUserId(context)
    const document = await loadOwned(userId, input.id)
    const versions = await versionsOf(document.id)
    const current = versions.at(-1)
    const version = assertFound(
      pickVersion(versions, input.versionNumber),
      "Versión no encontrada"
    )
    const dataKey = await unwrapDocumentKey(document)
    const bytes = await readVersion(document, dataKey, version)
    return new File(
      [bytes],
      downloadName(document.name, version.number, version === current),
      { type: "application/pdf" }
    )
  },

  rename: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.rename>
  }) => {
    const userId = requireUserId(context)
    const [row] = await db
      .update(documents)
      .set({ name: pdfName(input.name) })
      .where(ownedActive(userId, input.id))
      .returning()
    const document = assertFound(row, NOT_FOUND_MESSAGE)
    const versions = await versionsOf(document.id)
    const records = await signaturesOfDocument(userId, document.id)
    return summaryOf(document, versions, records)
  },

  delete: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.delete>
  }) => {
    const userId = requireUserId(context)
    // Crypto-shredding: without the data key no stored version can ever be
    // decrypted again. Name and signature records stay.
    const [row] = await db
      .update(documents)
      .set({ encryptedDataKey: null, deletedAt: new Date() })
      .where(ownedActive(userId, input.id))
      .returning()
    const document = assertFound(row, NOT_FOUND_MESSAGE)

    // Removing the objects is housekeeping: they are unreadable already.
    const versions = await versionsOf(document.id)
    for (const version of versions) {
      await objectStorage.deleteObject(version.objectKey).catch((error) => {
        getRequestLogger(context)?.warn(
          { err: error, objectKey: version.objectKey },
          "Could not remove a deleted document's object"
        )
      })
    }
    return { id: document.id, success: true }
  },

  sign: async ({ context, input }: { context: Context; input: SignInput }) => {
    const userId = requireUserId(context)
    const document = await loadOwned(userId, input.documentId)
    const versions = await versionsOf(document.id)
    const current = versions.at(-1)
    if (!current || current.id !== input.baseVersionId) {
      throw errors.CONFLICT({ message: CHANGED_MESSAGE })
    }

    const certificate = await loadSigningCertificate(
      userId,
      input.certificateId
    )
    const signingTime = new Date()
    if (certificate.notAfter.getTime() <= signingTime.getTime()) {
      throw errors.CONFLICT({
        message: "El certificado está caducado y ya no puede firmar",
      })
    }

    const dataKey = await unwrapDocumentKey(document)
    const pdf = await readVersion(document, dataKey, current)
    const signed = await signVersion(pdf, certificate, input, signingTime)

    const number = current.number + 1
    const objectKey = objectKeyFor(document.id, number)
    const sealed = await vault.seal(
      dataKey,
      documentScope(document.id),
      `v${number}`,
      signed.bytes
    )

    try {
      return await storeThenCommit(context, objectKey, sealed, () =>
        db.transaction(async (tx) => {
          const [version] = await tx
            .insert(documentVersions)
            .values({
              documentId: document.id,
              number,
              objectKey,
              sizeBytes: signed.bytes.length,
              sha256: sha256(signed.bytes),
              createdBy: userId,
            })
            .returning()
          if (!version) {
            throw errors.INTERNAL_SERVER_ERROR({
              message: "Version insert returned no row",
            })
          }
          const [signature] = await tx
            .insert(documentSignatures)
            .values({
              documentId: document.id,
              versionId: version.id,
              certificateId: certificate.id,
              userId,
              signedAt: signingTime,
              visible: input.appearance.visible,
              pages: signed.pages,
              rect: visibleAppearance(input.appearance)?.rect ?? null,
              reason: input.reason ?? null,
              location: input.location ?? null,
              sha256Before: current.sha256,
              sha256After: version.sha256,
              ipAddress: clientIp(context),
            })
            .returning()
          if (!signature) {
            throw errors.INTERNAL_SERVER_ERROR({
              message: "Signature insert returned no row",
            })
          }
          await tx
            .update(documents)
            .set({ updatedAt: signingTime })
            .where(eq(documents.id, document.id))
          return {
            version: toVersion(version),
            signature: toRecord({
              signature,
              documentName: document.name,
              documentDeletedAt: null,
              versionNumber: version.number,
              certificateAlias: certificate.alias,
              certificateHolder: certificate.commonName,
            }),
          }
        })
      )
    } catch (error) {
      // Another signature took this version number first.
      if (isUniqueViolation(error)) {
        throw errors.CONFLICT({ message: CHANGED_MESSAGE })
      }
      throw error
    }
  },

  signatures: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.signatures>
  }) => {
    const userId = requireUserId(context)
    if (input.documentId !== undefined) {
      const document = await db.query.documents.findFirst({
        where: { id: input.documentId, userId },
      })
      assertFound(document, NOT_FOUND_MESSAGE)
      return signaturesOfDocument(userId, input.documentId)
    }
    const certificateId = input.certificateId
    if (certificateId === undefined) {
      throw errors.BAD_REQUEST({
        message: "Indica un documento o un certificado",
      })
    }
    await assertOwnCertificate(userId, certificateId)
    const rows = await signatureJoin()
      .where(
        and(
          eq(documentSignatures.userId, userId),
          eq(documentSignatures.certificateId, certificateId)
        )
      )
      .orderBy(desc(documentSignatures.signedAt))
    return rows.map(toRecord)
  },

  signatureLog: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.signatureLog>
  }) => {
    const userId = requireUserId(context)
    const cursor = decodeKeysetCursor(input.cursor)
    if (input.certificateId !== undefined) {
      await assertOwnCertificate(userId, input.certificateId)
    }
    const filters = signatureLogFilters(userId, input)

    const { page, hasMore, lastRow, total } = await paginateWithTotal(
      withKeysetPagination(signatureJoin().$dynamic(), {
        orderColumns: [documentSignatures.signedAt, documentSignatures.id],
        cursor,
        filters,
        limit: input.limit + 1,
      }),
      db
        .select({ total: count() })
        .from(documentSignatures)
        .innerJoin(documents, eq(documents.id, documentSignatures.documentId))
        .where(and(...filters)),
      input.limit
    )

    return {
      records: page.map(toLogRecord),
      total,
      nextCursor: nextCursorOf(hasMore, lastRow),
    }
  },

  signatureLogCertificates: async ({ context }: { context: Context }) => {
    const userId = requireUserId(context)
    const rows = await db
      .select({
        id: certificates.id,
        alias: certificates.alias,
        holder: certificates.commonName,
        deletedAt: certificates.deletedAt,
      })
      .from(documentSignatures)
      .innerJoin(
        certificates,
        eq(certificates.id, documentSignatures.certificateId)
      )
      .where(eq(documentSignatures.userId, userId))
      .groupBy(certificates.id)
      .orderBy(asc(certificates.alias), asc(certificates.id))
    return rows.map((row) => ({
      id: row.id,
      alias: row.alias,
      holder: row.holder,
      deleted: row.deletedAt !== null,
    }))
  },
}
