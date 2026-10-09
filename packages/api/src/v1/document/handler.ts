import { createHash } from "node:crypto"
import { EncryptedPDFError, PDFDocument } from "@cantoo/pdf-lib"
import { db } from "@nonete/db"
import { withKeysetPagination } from "@nonete/db/keyset-pagination"
import {
  type Certificate,
  certificates,
  type Document,
  type DocumentVersion,
  type DocumentVersionKind,
  documentFolders,
  documentSignatures,
  documents,
  documentTagAssignments,
  documentTags,
  documentVersions,
  type TraceFolderRef,
} from "@nonete/db/schema"
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
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
import { getTimestamper } from "#lib/timestamp"
import { requireUserId } from "#shared/caller"
import {
  openCertificateFile,
  openRememberedPassword,
  rejectPkcs12,
} from "#shared/certificate-secrets"
import { clientIp } from "#shared/client-ip"
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
import { recordTraces } from "#shared/trace"
import { VaultError, type VaultScope, vault } from "#shared/vault"
import { type documentInput, MAX_PDF_BYTES } from "#v1/document/input"
import type {
  DocumentSummary,
  DocumentVersionOutput,
  SignatureRecord,
  SignatureReportOutput,
  VerifySignaturesOutput,
} from "#v1/document/output"
import { AppearanceError } from "#v1/document/pades/appearance"
import { EncryptedPdfError } from "#v1/document/pades/placeholder"
import { signPdf } from "#v1/document/pades/sign"
import { TimestampError } from "#v1/document/pades/timestamp"
import {
  hasEmbeddedSignature,
  mergePdfs,
  PageListError,
  rewritePages,
} from "#v1/document/pages"
import {
  type SignatureLogJoin,
  signatureJoin,
  toLogRecord,
  toRecord,
} from "#v1/document/signature-records"
import {
  type SignatureReport,
  validateSignatures,
} from "#v1/document/validation/verify"

const NOT_FOUND_MESSAGE = "Documento no encontrado"
const SOME_NOT_FOUND_MESSAGE = "Alguno de los documentos no existe"
const FOLDER_NOT_FOUND_MESSAGE = "Carpeta no encontrada"
const TAG_NOT_FOUND_MESSAGE = "Alguna de las etiquetas no existe"
const CERTIFICATE_NOT_FOUND_MESSAGE = "Certificado no encontrado"
const CHANGED_MESSAGE =
  "El documento ha cambiado desde que lo abriste; recárgalo para firmar la última versión"
const EDIT_CHANGED_MESSAGE =
  "El documento ha cambiado desde que lo abriste; recárgalo para editar la última versión"
const EDIT_SIGNED_MESSAGE =
  "Este documento tiene firmas: editar sus páginas las invalidaría"
const VERSION_CHANGED_MESSAGE =
  "El documento ha cambiado desde que lo abriste; recárgalo para eliminar su última versión"
const ONLY_VERSION_MESSAGE =
  "No se puede eliminar la única versión del documento; elimina el documento si ya no lo necesitas"
// Merge sources are decrypted in memory: past this sum, refuse before that.
const MAX_MERGE_SOURCE_BYTES = 60 * 1024 * 1024
const MERGE_TOO_LARGE_MESSAGE =
  "El PDF unido superaría los 20 MiB; une menos documentos o más pequeños"

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
    kind: row.kind,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    createdAt: toIso(row.createdAt),
  }
}

function summaryOf(
  document: Document,
  versions: DocumentVersion[],
  records: SignatureRecord[],
  tagIds: string[]
): DocumentSummary {
  const current = versions.at(-1)
  // Records of a deleted version stay listed but no longer sign the document.
  const live = records.filter((record) => !record.versionDeleted)
  return {
    id: document.id,
    name: document.name,
    pageCount: document.pageCount,
    sizeBytes: current?.sizeBytes ?? 0,
    versionCount: versions.length,
    signatureCount: live.length,
    lastSignedAt: live[0]?.signedAt ?? null,
    folderId: document.folderId,
    tagIds,
    pinnedAt: toIsoOrNull(document.pinnedAt),
    createdAt: toIso(document.createdAt),
    updatedAt: toIso(document.updatedAt),
  }
}

// The requested version, or the current (latest) one when none is asked.
function toReport(report: SignatureReport): SignatureReportOutput {
  const { signer, timestamp } = report
  return {
    fieldName: report.fieldName,
    subFilter: report.subFilter,
    level: report.level,
    claimedTime: toIsoOrNull(report.claimedTime),
    reason: report.reason,
    location: report.location,
    signer: signer && {
      holder: signer.commonName,
      taxId: signer.taxId,
      issuer: signer.issuerCommonName,
      serialNumber: signer.serialNumber,
      notBefore: toIso(signer.notBefore),
      notAfter: toIso(signer.notAfter),
    },
    timestamp: timestamp && {
      time: toIso(timestamp.time),
      authority: timestamp.authority,
      valid: timestamp.valid,
    },
    coverage: report.coverage,
    checks: report.checks,
    verdict: report.verdict,
    problem: report.problem,
    modifiedAfterSigning: report.modifiedAfterSigning,
  }
}

function pickVersionById(versions: DocumentVersion[], id: string | undefined) {
  if (id === undefined) return versions.at(-1)
  return versions.find((version) => version.id === id)
}

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

type Executor = Pick<typeof db, "select" | "query">

async function loadOwned(userId: string, id: string, executor: Executor = db) {
  const row = await executor.query.documents.findFirst({
    where: { id, userId, deletedAt: { isNull: true } },
  })
  return assertFound(row, NOT_FOUND_MESSAGE)
}

async function tagIdsOf(documentId: string) {
  const rows = await db
    .select({ tagId: documentTagAssignments.tagId })
    .from(documentTagAssignments)
    .where(eq(documentTagAssignments.documentId, documentId))
    .orderBy(asc(documentTagAssignments.tagId))
  return rows.map((row) => row.tagId)
}

/**
 * The distinct `ids`, after checking every one is a live document of the
 * caller; otherwise NOT_FOUND, before anything is written.
 */
async function assertOwnedActive(
  executor: Executor,
  userId: string,
  ids: string[],
  notFoundMessage = SOME_NOT_FOUND_MESSAGE
) {
  const unique = [...new Set(ids)]
  const rows = await executor
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        isNull(documents.deletedAt),
        inArray(documents.id, unique)
      )
    )
  if (rows.length !== unique.length) {
    throw errors.NOT_FOUND({ message: notFoundMessage })
  }
  return unique
}

async function assertOwnedFolder(
  executor: Executor,
  userId: string,
  folderId: string
) {
  const folder = await executor.query.documentFolders.findFirst({
    where: { id: folderId, userId },
  })
  assertFound(folder, FOLDER_NOT_FOUND_MESSAGE)
}

async function assertOwnedTags(
  executor: Executor,
  userId: string,
  tagIds: string[]
) {
  const unique = [...new Set(tagIds)]
  const rows = await executor
    .select({ id: documentTags.id })
    .from(documentTags)
    .where(
      and(eq(documentTags.userId, userId), inArray(documentTags.id, unique))
    )
  if (rows.length !== unique.length) {
    throw errors.NOT_FOUND({ message: TAG_NOT_FOUND_MESSAGE })
  }
}

/**
 * Crypto-shreds the caller's documents `ids` all-or-nothing: without the data
 * key no stored version can ever be decrypted again. Names and signature
 * records stay; tags and pins go. Removing the objects afterwards is
 * housekeeping, best-effort, since they are unreadable already.
 */
async function deleteDocuments(
  context: Context,
  userId: string,
  ids: string[],
  notFoundMessage = SOME_NOT_FOUND_MESSAGE
) {
  const deleted = await db.transaction(async (tx) => {
    const unique = await assertOwnedActive(tx, userId, ids, notFoundMessage)
    const rows = await tx
      .update(documents)
      .set({ encryptedDataKey: null, deletedAt: new Date(), pinnedAt: null })
      .where(
        and(
          eq(documents.userId, userId),
          isNull(documents.deletedAt),
          inArray(documents.id, unique)
        )
      )
      .returning({ id: documents.id })
    // A concurrent delete got there first: roll the whole batch back.
    if (rows.length !== unique.length) {
      throw errors.NOT_FOUND({ message: notFoundMessage })
    }
    await tx
      .delete(documentTagAssignments)
      .where(inArray(documentTagAssignments.documentId, unique))
    await recordTraces(
      tx,
      context,
      userId,
      unique.map((id) => ({ type: "document.deleted", documentId: id }))
    )
    return unique
  })

  const versions = await db.query.documentVersions.findMany({
    where: { documentId: { in: deleted } },
  })
  for (const version of versions) {
    await objectStorage.deleteObject(version.objectKey).catch((error) => {
      getRequestLogger(context)?.warn(
        { err: error, objectKey: version.objectKey },
        "Could not remove a deleted document's object"
      )
    })
  }
  return deleted
}

/** Every stored version of a document, deleted ones included, oldest first. */
async function storedVersionsOf(documentId: string) {
  return db.query.documentVersions.findMany({
    where: { documentId },
    orderBy: { number: "asc" },
  })
}

/** The versions that make up the document: the stored ones not deleted. */
function liveVersions(versions: DocumentVersion[]) {
  return versions.filter((version) => version.deletedAt === null)
}

/** One above the highest number ever stored, so no number is ever reused. */
function nextVersionNumber(stored: DocumentVersion[]) {
  const highest = stored.at(-1)
  if (!highest) return 1
  return highest.number + 1
}

async function versionsOf(documentId: string) {
  return liveVersions(await storedVersionsOf(documentId))
}

/**
 * Locks the document row for the rest of `tx` and returns its current live
 * version, read after the lock so it sees whatever a concurrent writer
 * committed first. Writers that add or delete a version take this lock, so
 * none of them builds on a version another one just replaced.
 */
async function lockCurrentVersion(tx: Executor, documentId: string) {
  await tx
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.id, documentId))
    .for("update")
  const [current] = await tx
    .select({ id: documentVersions.id })
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, documentId),
        isNull(documentVersions.deletedAt)
      )
    )
    .orderBy(desc(documentVersions.number))
    .limit(1)
  return current
}

/** Refuses with CONFLICT when `versionId` is no longer the current version. */
async function assertStillCurrent(
  tx: Executor,
  documentId: string,
  versionId: string,
  message: string
) {
  const current = await lockCurrentVersion(tx, documentId)
  if (current?.id !== versionId) throw errors.CONFLICT({ message })
}

/** A document as `get` returns it: summary, live versions and every record. */
async function detailOf(
  userId: string,
  document: Document,
  versions: DocumentVersion[]
) {
  const records = await signaturesOfDocument(userId, document.id)
  const tagIds = await tagIdsOf(document.id)
  return {
    ...summaryOf(document, versions, records, tagIds),
    versions: versions.map(toVersion),
    signatures: records,
  }
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

const TIMESTAMP_MESSAGE =
  "No se pudo obtener el sello de tiempo de la autoridad configurada"

/** A TSA that did not answer is unavailable; any other failure is its fault. */
function timestampFailure(error: TimestampError) {
  if (error.kind === "unreachable") {
    return errors.SERVICE_UNAVAILABLE({
      message: TIMESTAMP_MESSAGE,
      cause: error,
    })
  }
  return errors.BAD_GATEWAY({ message: TIMESTAMP_MESSAGE, cause: error })
}

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
      timestamper: getTimestamper(),
    })
  } catch (error) {
    if (error instanceof TimestampError) throw timestampFailure(error)
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

/** The trace of a new document: an upload, or a merge with its sources. */
type CreationTrace =
  | { type: "document.uploaded" }
  | { type: "document.merged"; details: { sources: DocumentRef[] } }

type DocumentRef = { id: string; name: string }

/** A folder as a trace keeps it; the root when `id` is null. */
function folderRef(
  id: string | null,
  names: Map<string, string>
): TraceFolderRef {
  if (id === null) return null
  return { id, name: names.get(id) ?? "" }
}

/**
 * Moves the caller's documents `ids` to `folderId` and traces each document
 * whose folder changes, with the origin and destination as they are named now.
 */
async function moveDocuments(
  context: Context,
  userId: string,
  ids: string[],
  folderId: string | null
) {
  return db.transaction(async (tx) => {
    const unique = await assertOwnedActive(tx, userId, ids)
    if (folderId !== null) await assertOwnedFolder(tx, userId, folderId)
    const before = await tx
      .select({ id: documents.id, folderId: documents.folderId })
      .from(documents)
      .where(and(eq(documents.userId, userId), inArray(documents.id, unique)))
    await tx
      .update(documents)
      .set({ folderId })
      .where(and(eq(documents.userId, userId), inArray(documents.id, unique)))

    const moved = before.filter((row) => row.folderId !== folderId)
    if (moved.length === 0) return unique
    const folderIds = new Set<string>()
    for (const row of moved) {
      if (row.folderId !== null) folderIds.add(row.folderId)
    }
    if (folderId !== null) folderIds.add(folderId)
    const names = await folderNames(tx, userId, [...folderIds])
    await recordTraces(
      tx,
      context,
      userId,
      moved.map((row) => ({
        type: "document.moved",
        documentId: row.id,
        details: {
          from: folderRef(row.folderId, names),
          to: folderRef(folderId, names),
        },
      }))
    )
    return unique
  })
}

async function folderNames(executor: Executor, userId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>()
  const rows = await executor
    .select({ id: documentFolders.id, name: documentFolders.name })
    .from(documentFolders)
    .where(
      and(eq(documentFolders.userId, userId), inArray(documentFolders.id, ids))
    )
  return new Map(rows.map((row) => [row.id, row.name]))
}

/**
 * Creates one of the caller's documents from `bytes` as version 1 of `kind`:
 * checks the PDF and the folder, seals the bytes under a new data key, stores
 * them and inserts the document and its version in one transaction.
 */
async function createDocument(
  context: Context,
  {
    name,
    folderId,
    bytes,
    kind,
    trace,
  }: {
    name: string
    folderId: string | null
    bytes: Uint8Array<ArrayBuffer>
    kind: DocumentVersionKind
    trace: CreationTrace
  }
) {
  const userId = requireUserId(context)
  const pageCount = await pageCountOf(bytes)
  if (folderId !== null) await assertOwnedFolder(db, userId, folderId)

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
            name,
            pageCount,
            folderId,
            encryptedDataKey,
          })
          .returning()
        const [versionRow] = await tx
          .insert(documentVersions)
          .values({
            documentId: id,
            number: 1,
            kind,
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
        await recordTraces(tx, context, userId, [
          { ...trace, documentId: id, versionId: versionRow.id },
        ])
        return { document: documentRow, version: versionRow }
      })
  )
  return summaryOf(document, [version], [], [])
}

/** How many signature records on live versions each of `documentIds` has. */
async function signatureCounts(documentIds: string[]) {
  const rows = await db
    .select({
      documentId: documentSignatures.documentId,
      total: count(),
    })
    .from(documentSignatures)
    .innerJoin(
      documentVersions,
      and(
        eq(documentVersions.id, documentSignatures.versionId),
        isNull(documentVersions.deletedAt)
      )
    )
    .where(inArray(documentSignatures.documentId, documentIds))
    .groupBy(documentSignatures.documentId)
  return new Map(rows.map((row) => [row.documentId, row.total]))
}

/**
 * Refuses to rewrite a document that carries signatures, recorded here or
 * embedded in `bytes` by another tool: rewriting would invalidate them.
 */
async function assertRewritable(
  recordCount: number,
  bytes: Uint8Array<ArrayBuffer>,
  message: string
) {
  if (recordCount > 0 || (await hasEmbeddedSignature(bytes))) {
    throw errors.CONFLICT({ message })
  }
}

function rejectPageList(error: unknown): never {
  if (error instanceof PageListError) {
    throw errors.BAD_REQUEST({ message: error.message })
  }
  throw error
}

/** The caller's live documents `ids`, in that order; NOT_FOUND otherwise. */
async function loadOwnedInOrder(userId: string, ids: string[]) {
  const rows = await db.query.documents.findMany({
    where: { id: { in: ids }, userId, deletedAt: { isNull: true } },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.map((id) => assertFound(byId.get(id), SOME_NOT_FOUND_MESSAGE))
}

/** The latest version of each document, keyed by document id. */
function currentVersions(versions: DocumentVersion[]) {
  const current = new Map<string, DocumentVersion>()
  for (const version of versions) {
    const seen = current.get(version.documentId)
    if (!seen || seen.number < version.number) {
      current.set(version.documentId, version)
    }
  }
  return current
}

/** One of the caller's versions as a PDF file named after the document. */
async function versionFile(
  userId: string,
  input: z.infer<typeof documentInput.download>
) {
  const document = await loadOwned(userId, input.id)
  const versions = await versionsOf(document.id)
  const current = versions.at(-1)
  const version = assertFound(
    pickVersion(versions, input.versionNumber),
    "Versión no encontrada"
  )
  const dataKey = await unwrapDocumentKey(document)
  const bytes = await readVersion(document, dataKey, version)
  const file = new File(
    [bytes],
    downloadName(document.name, version.number, version === current),
    { type: "application/pdf" }
  )
  return { file, document, version }
}

export const documentHandler = {
  upload: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.upload>
  }) => {
    const bytes = new Uint8Array(await input.file.arrayBuffer())
    return createDocument(context, {
      name: documentName(input.file.name),
      folderId: input.folderId ?? null,
      bytes,
      kind: "upload",
      trace: { type: "document.uploaded" },
    })
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
      .where(isNull(documentVersions.deletedAt))
      .groupBy(documentVersions.documentId)
      .as("current_version")
    const signatureStats = db
      .select({
        documentId: documentSignatures.documentId,
        signatureCount: sql<number>`count(*)::int`.as("signature_count"),
        lastSignedAt: max(documentSignatures.signedAt).as("last_signed_at"),
      })
      .from(documentSignatures)
      // Records of a deleted version no longer sign the document.
      .innerJoin(
        documentVersions,
        and(
          eq(documentVersions.id, documentSignatures.versionId),
          isNull(documentVersions.deletedAt)
        )
      )
      .groupBy(documentSignatures.documentId)
      .as("signature_stats")
    // `text[]` so the driver hands back plain strings.
    const tagLists = db
      .select({
        documentId: documentTagAssignments.documentId,
        tagIds: sql<
          string[]
        >`array_agg(${documentTagAssignments.tagId} order by ${documentTagAssignments.tagId})::text[]`.as(
          "tag_ids"
        ),
      })
      .from(documentTagAssignments)
      .groupBy(documentTagAssignments.documentId)
      .as("tag_lists")

    const rows = await db
      .select({
        document: documents,
        versionCount: currentVersion.versionCount,
        sizeBytes: currentVersion.sizeBytes,
        signatureCount: signatureStats.signatureCount,
        lastSignedAt: signatureStats.lastSignedAt,
        tagIds: tagLists.tagIds,
      })
      .from(documents)
      .leftJoin(currentVersion, eq(currentVersion.documentId, documents.id))
      .leftJoin(signatureStats, eq(signatureStats.documentId, documents.id))
      .leftJoin(tagLists, eq(tagLists.documentId, documents.id))
      .where(and(eq(documents.userId, userId), isNull(documents.deletedAt)))
      // Pinned first, most recently pinned first; then newest first.
      .orderBy(
        sql`${documents.pinnedAt} desc nulls last`,
        desc(documents.createdAt)
      )

    return rows.map(
      (row): DocumentSummary => ({
        id: row.document.id,
        name: row.document.name,
        pageCount: row.document.pageCount,
        sizeBytes: row.sizeBytes ?? 0,
        versionCount: row.versionCount ?? 0,
        signatureCount: row.signatureCount ?? 0,
        lastSignedAt: toIsoOrNull(row.lastSignedAt),
        folderId: row.document.folderId,
        tagIds: row.tagIds ?? [],
        pinnedAt: toIsoOrNull(row.document.pinnedAt),
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
    return detailOf(userId, document, await versionsOf(document.id))
  },

  download: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.download>
  }) => {
    const { file } = await versionFile(requireUserId(context), input)
    return file
  },

  exportVersion: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.download>
  }) => {
    const userId = requireUserId(context)
    const { file, document, version } = await versionFile(userId, input)
    await recordTraces(db, context, userId, [
      {
        type: "document.downloaded",
        documentId: document.id,
        versionId: version.id,
      },
    ])
    return file
  },

  verifySignatures: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.verifySignatures>
  }) => {
    const userId = requireUserId(context)
    const document = await loadOwned(userId, input.documentId)
    const versions = await versionsOf(document.id)
    const version = assertFound(
      pickVersionById(versions, input.versionId),
      "Versión no encontrada"
    )
    const dataKey = await unwrapDocumentKey(document)
    const bytes = await readVersion(document, dataKey, version)
    const result = await validateSignatures(new Uint8Array(bytes))
    return {
      versionId: version.id,
      signatures: result.signatures.map(toReport),
      parseError: result.parseError,
      revocationChecked: false,
    } satisfies VerifySignaturesOutput
  },

  rename: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.rename>
  }) => {
    const userId = requireUserId(context)
    const document = await db.transaction(async (tx) => {
      const previous = await loadOwned(userId, input.id, tx)
      const [row] = await tx
        .update(documents)
        .set({ name: pdfName(input.name) })
        .where(ownedActive(userId, input.id))
        .returning()
      const renamed = assertFound(row, NOT_FOUND_MESSAGE)
      if (renamed.name !== previous.name) {
        await recordTraces(tx, context, userId, [
          {
            type: "document.renamed",
            documentId: renamed.id,
            details: { from: previous.name, to: renamed.name },
          },
        ])
      }
      return renamed
    })
    const versions = await versionsOf(document.id)
    const records = await signaturesOfDocument(userId, document.id)
    const tagIds = await tagIdsOf(document.id)
    return summaryOf(document, versions, records, tagIds)
  },

  delete: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.delete>
  }) => {
    const userId = requireUserId(context)
    await deleteDocuments(context, userId, [input.id], NOT_FOUND_MESSAGE)
    return { id: input.id, success: true }
  },

  deleteMany: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.deleteMany>
  }) => {
    const userId = requireUserId(context)
    const ids = await deleteDocuments(context, userId, input.ids)
    return { ids, success: true }
  },

  move: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.move>
  }) => {
    const userId = requireUserId(context)
    const ids = await moveDocuments(context, userId, input.ids, input.folderId)
    return { ids, success: true }
  },

  updateTags: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.updateTags>
  }) => {
    const userId = requireUserId(context)
    const ids = await db.transaction(async (tx) => {
      const unique = await assertOwnedActive(tx, userId, input.ids)
      await assertOwnedTags(tx, userId, [...input.add, ...input.remove])
      const add = [...new Set(input.add)]
      if (add.length > 0) {
        const pairs = unique.flatMap((documentId) =>
          add.map((tagId) => ({ documentId, tagId }))
        )
        await tx
          .insert(documentTagAssignments)
          .values(pairs)
          .onConflictDoNothing()
      }
      if (input.remove.length > 0) {
        await tx
          .delete(documentTagAssignments)
          .where(
            and(
              inArray(documentTagAssignments.documentId, unique),
              inArray(documentTagAssignments.tagId, input.remove)
            )
          )
      }
      return unique
    })
    return { ids, success: true }
  },

  setPinned: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.setPinned>
  }) => {
    const userId = requireUserId(context)
    // Pinning again keeps the first pin moment, so the order stays stable.
    const pinnedAt = input.pinned
      ? sql`coalesce(${documents.pinnedAt}, now())`
      : null
    const ids = await db.transaction(async (tx) => {
      const unique = await assertOwnedActive(tx, userId, input.ids)
      await tx
        .update(documents)
        .set({ pinnedAt })
        .where(and(eq(documents.userId, userId), inArray(documents.id, unique)))
      return unique
    })
    return { ids, success: true }
  },

  sign: async ({ context, input }: { context: Context; input: SignInput }) => {
    const userId = requireUserId(context)
    const document = await loadOwned(userId, input.documentId)
    const stored = await storedVersionsOf(document.id)
    const current = liveVersions(stored).at(-1)
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

    const number = nextVersionNumber(stored)
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
          await assertStillCurrent(tx, document.id, current.id, CHANGED_MESSAGE)
          const [version] = await tx
            .insert(documentVersions)
            .values({
              documentId: document.id,
              number,
              kind: "signature",
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
              timestampedAt: signed.timestamp?.time ?? null,
              timestampAuthority: signed.timestamp?.authority ?? null,
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
              versionDeletedAt: null,
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

  editPages: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.editPages>
  }) => {
    const userId = requireUserId(context)
    const document = await loadOwned(userId, input.documentId)
    const stored = await storedVersionsOf(document.id)
    const current = liveVersions(stored).at(-1)
    if (!current || current.id !== input.baseVersionId) {
      throw errors.CONFLICT({ message: EDIT_CHANGED_MESSAGE })
    }
    const records = await signatureCounts([document.id])

    const dataKey = await unwrapDocumentKey(document)
    const pdf = await readVersion(document, dataKey, current)
    await assertRewritable(
      records.get(document.id) ?? 0,
      pdf,
      EDIT_SIGNED_MESSAGE
    )
    const edited = await rewritePages(pdf, input.pages).catch(rejectPageList)

    const pageCount = input.pages.length
    const number = nextVersionNumber(stored)
    const objectKey = objectKeyFor(document.id, number)
    const sealed = await vault.seal(
      dataKey,
      documentScope(document.id),
      `v${number}`,
      edited
    )

    try {
      return await storeThenCommit(context, objectKey, sealed, () =>
        db.transaction(async (tx) => {
          await assertStillCurrent(
            tx,
            document.id,
            current.id,
            EDIT_CHANGED_MESSAGE
          )
          const [version] = await tx
            .insert(documentVersions)
            .values({
              documentId: document.id,
              number,
              kind: "pages",
              objectKey,
              sizeBytes: edited.length,
              sha256: sha256(edited),
              createdBy: userId,
            })
            .returning()
          if (!version) {
            throw errors.INTERNAL_SERVER_ERROR({
              message: "Version insert returned no row",
            })
          }
          await tx
            .update(documents)
            .set({ pageCount, updatedAt: version.createdAt })
            .where(eq(documents.id, document.id))
          await recordTraces(tx, context, userId, [
            {
              type: "document.pagesEdited",
              documentId: document.id,
              versionId: version.id,
            },
          ])
          return { version: toVersion(version), pageCount }
        })
      )
    } catch (error) {
      // A signature or another edit took this version number first.
      if (isUniqueViolation(error)) {
        throw errors.CONFLICT({ message: EDIT_CHANGED_MESSAGE })
      }
      throw error
    }
  },

  deleteLatestVersion: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.deleteLatestVersion>
  }) => {
    const userId = requireUserId(context)
    const document = await loadOwned(userId, input.id)
    const versions = await versionsOf(document.id)
    const current = versions.at(-1)
    if (!current || current.id !== input.versionId) {
      throw errors.CONFLICT({ message: VERSION_CHANGED_MESSAGE })
    }
    const previous = versions.at(-2)
    if (!previous) throw errors.CONFLICT({ message: ONLY_VERSION_MESSAGE })

    // The page count the document goes back to, read before locking anything.
    const dataKey = await unwrapDocumentKey(document)
    const pageCount = await pageCountOf(
      await readVersion(document, dataKey, previous)
    )

    const updated = await db.transaction(async (tx) => {
      await assertStillCurrent(
        tx,
        document.id,
        current.id,
        VERSION_CHANGED_MESSAGE
      )
      const deletedAt = new Date()
      await tx
        .update(documentVersions)
        .set({ deletedAt })
        .where(eq(documentVersions.id, current.id))
      const [row] = await tx
        .update(documents)
        .set({ pageCount, updatedAt: deletedAt })
        .where(eq(documents.id, document.id))
        .returning()
      await recordTraces(tx, context, userId, [
        {
          type: "document.versionDeleted",
          documentId: document.id,
          versionId: current.id,
        },
      ])
      return assertFound(row, NOT_FOUND_MESSAGE)
    })

    // Housekeeping: no read reaches a deleted version's object any more.
    await objectStorage.deleteObject(current.objectKey).catch((error) => {
      getRequestLogger(context)?.warn(
        { err: error, objectKey: current.objectKey },
        "Could not remove a deleted version's object"
      )
    })
    return detailOf(userId, updated, versions.slice(0, -1))
  },

  merge: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentInput.merge>
  }) => {
    const userId = requireUserId(context)
    if (new Set(input.documentIds).size !== input.documentIds.length) {
      throw errors.BAD_REQUEST({
        message: "Has elegido el mismo documento más de una vez",
      })
    }
    const owned = await loadOwnedInOrder(userId, input.documentIds)
    const current = currentVersions(
      await db.query.documentVersions.findMany({
        where: {
          documentId: { in: input.documentIds },
          deletedAt: { isNull: true },
        },
      })
    )
    const sources = owned.map((document) => ({
      document,
      version: assertFound(current.get(document.id), SOME_NOT_FOUND_MESSAGE),
    }))
    const sourceBytes = sources.reduce(
      (total, source) => total + source.version.sizeBytes,
      0
    )
    if (sourceBytes > MAX_MERGE_SOURCE_BYTES) {
      throw errors.BAD_REQUEST({ message: MERGE_TOO_LARGE_MESSAGE })
    }
    const records = await signatureCounts(input.documentIds)

    const pdfs: Uint8Array<ArrayBuffer>[] = []
    for (const { document, version } of sources) {
      const dataKey = await unwrapDocumentKey(document)
      const pdf = await readVersion(document, dataKey, version)
      await assertRewritable(
        records.get(document.id) ?? 0,
        pdf,
        `«${document.name}» tiene firmas: unirlo las invalidaría`
      )
      pdfs.push(pdf)
    }

    const merged = await mergePdfs(pdfs)
    if (merged.length > MAX_PDF_BYTES) {
      throw errors.BAD_REQUEST({ message: MERGE_TOO_LARGE_MESSAGE })
    }
    return createDocument(context, {
      name: pdfName(input.name),
      folderId: input.folderId ?? null,
      bytes: merged,
      kind: "merge",
      trace: {
        type: "document.merged",
        details: {
          sources: owned.map((document) => ({
            id: document.id,
            name: document.name,
          })),
        },
      },
    })
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
