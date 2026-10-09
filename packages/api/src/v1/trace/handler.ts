import { db } from "@nonete/db"
import { withKeysetPagination } from "@nonete/db/keyset-pagination"
import {
  certificates,
  documentSignatures,
  documents,
  documentVersions,
  type TraceDetails,
  type TraceType,
  traceEvents,
} from "@nonete/db/schema"
import {
  and,
  asc,
  count,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { requireUserId } from "#shared/caller"
import { toIso } from "#shared/dates"
import { assertFound } from "#shared/not-found"
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  paginateWithTotal,
} from "#shared/pagination"
import { likePattern } from "#shared/search"
import type { SignatureLogRecord } from "#v1/document/output"
import { signatureJoin, toLogRecord } from "#v1/document/signature-records"
import type { TrailType, traceInput } from "#v1/trace/input"
import type { TrailCommon, TrailEntry } from "#v1/trace/output"

type ListInput = z.infer<typeof traceInput.list>

const SIGNED: TrailType = "document.signed"

/** Whether the filters let entries of `type` through. */
function admits(input: ListInput, type: TrailType) {
  if (input.excludedTypes?.includes(type)) return false
  if (input.types === undefined) return true
  return input.types.includes(type)
}

function isTraceType(type: TrailType): type is TraceType {
  return type !== SIGNED
}

// The stored traces the filters admit, before the text filter.
function eventFilters(userId: string, input: ListInput) {
  const filters: SQL[] = [eq(traceEvents.userId, userId)]
  if (input.types !== undefined) {
    const included = input.types.filter(isTraceType)
    if (included.length === 0) filters.push(sql`false`)
    else filters.push(inArray(traceEvents.type, included))
  }
  if (input.excludedTypes !== undefined) {
    const excluded = input.excludedTypes.filter(isTraceType)
    if (excluded.length > 0) {
      filters.push(notInArray(traceEvents.type, excluded))
    }
  }
  if (input.certificateId !== undefined) {
    filters.push(eq(traceEvents.certificateId, input.certificateId))
  }
  if (input.from !== undefined) {
    filters.push(gte(traceEvents.occurredAt, new Date(input.from)))
  }
  if (input.before !== undefined) {
    filters.push(lt(traceEvents.occurredAt, new Date(input.before)))
  }
  return filters
}

// The signature records the filters admit, before the text filter.
function signatureFilters(userId: string, input: ListInput) {
  const filters: SQL[] = [eq(documentSignatures.userId, userId)]
  if (!admits(input, SIGNED)) filters.push(sql`false`)
  if (input.certificateId !== undefined) {
    filters.push(eq(documentSignatures.certificateId, input.certificateId))
  }
  if (input.from !== undefined) {
    filters.push(gte(documentSignatures.signedAt, new Date(input.from)))
  }
  if (input.before !== undefined) {
    filters.push(lt(documentSignatures.signedAt, new Date(input.before)))
  }
  return filters
}

/**
 * The caller's trail as one subquery: their traces and, as `document.signed`
 * entries, their signature records, each branch filtered on its own indexes.
 */
function trail(userId: string, input: ListInput) {
  const events = db
    .select({
      id: traceEvents.id,
      type: sql<TrailType>`${traceEvents.type}`.as("type"),
      occurredAt: traceEvents.occurredAt,
      documentId: traceEvents.documentId,
      certificateId: traceEvents.certificateId,
      versionId: traceEvents.versionId,
      ipAddress: traceEvents.ipAddress,
      details: traceEvents.details,
    })
    .from(traceEvents)
    .where(and(...eventFilters(userId, input)))
  const signatures = db
    .select({
      id: documentSignatures.id,
      // Typed, so the union does not have to infer the parameter.
      type: sql<TrailType>`${SIGNED}::text`.as("type"),
      occurredAt: documentSignatures.signedAt,
      documentId: documentSignatures.documentId,
      certificateId: documentSignatures.certificateId,
      versionId: documentSignatures.versionId,
      ipAddress: documentSignatures.ipAddress,
      details: sql<TraceDetails | null>`null::jsonb`.as("details"),
    })
    .from(documentSignatures)
    .where(and(...signatureFilters(userId, input)))
  return events.unionAll(signatures).as("trail")
}

// Filters on what each entry shows, over the trail joined to it.
function trailFilters(input: ListInput) {
  const filters: SQL[] = []
  if (input.query !== undefined) {
    const pattern = likePattern(input.query)
    const matches = or(
      ilike(documents.name, pattern),
      ilike(certificates.alias, pattern)
    )
    if (matches) filters.push(matches)
  }
  return filters
}

type TrailRow = {
  id: string
  type: TrailType
  occurredAt: Date
  ipAddress: string | null
  details: TraceDetails | null
  documentId: string | null
  documentName: string | null
  documentDeletedAt: Date | null
  certificateId: string | null
  certificateAlias: string | null
  certificateHolder: string | null
  certificateDeletedAt: Date | null
  versionId: string | null
  versionNumber: number | null
  versionDeletedAt: Date | null
}

function documentOf(row: TrailRow): TrailCommon["document"] {
  if (row.documentId === null || row.documentName === null) return null
  return {
    id: row.documentId,
    name: row.documentName,
    deleted: row.documentDeletedAt !== null,
  }
}

function certificateOf(row: TrailRow): TrailCommon["certificate"] {
  if (
    row.certificateId === null ||
    row.certificateAlias === null ||
    row.certificateHolder === null
  ) {
    return null
  }
  return {
    id: row.certificateId,
    alias: row.certificateAlias,
    holder: row.certificateHolder,
    deleted: row.certificateDeletedAt !== null,
  }
}

function versionOf(row: TrailRow): TrailCommon["version"] {
  if (row.versionId === null || row.versionNumber === null) return null
  return {
    id: row.versionId,
    number: row.versionNumber,
    deleted: row.versionDeletedAt !== null,
  }
}

function commonOf(row: TrailRow): TrailCommon {
  return {
    id: row.id,
    occurredAt: toIso(row.occurredAt),
    ipAddress: row.ipAddress,
    document: documentOf(row),
    certificate: certificateOf(row),
    version: versionOf(row),
  }
}

function malformed(row: TrailRow): never {
  throw errors.INTERNAL_SERVER_ERROR({
    message: `Trace ${row.id} of type ${row.type} has malformed details`,
  })
}

function renameOf(row: TrailRow) {
  const { details } = row
  if (details === null || !("from" in details)) return malformed(row)
  if (typeof details.from !== "string" || typeof details.to !== "string") {
    return malformed(row)
  }
  return { from: details.from, to: details.to }
}

function moveOf(row: TrailRow) {
  const { details } = row
  if (details === null || !("from" in details)) return malformed(row)
  if (typeof details.from === "string" || typeof details.to === "string") {
    return malformed(row)
  }
  return { from: details.from, to: details.to }
}

function mergeOf(row: TrailRow) {
  const { details } = row
  if (details === null || !("sources" in details)) return malformed(row)
  return { sources: details.sources }
}

function toEntry(
  row: TrailRow,
  signatures: Map<string, SignatureLogRecord>
): TrailEntry {
  const common = commonOf(row)
  switch (row.type) {
    case "certificate.renamed":
    case "document.renamed":
      return { ...common, type: row.type, details: renameOf(row) }
    case "document.moved":
      return { ...common, type: row.type, details: moveOf(row) }
    case "document.merged":
      return { ...common, type: row.type, details: mergeOf(row) }
    case "document.signed":
      return {
        ...common,
        type: row.type,
        details: null,
        signature: assertFound(
          signatures.get(row.id),
          "Registro de firma no encontrado"
        ),
      }
    default:
      return { ...common, type: row.type, details: null }
  }
}

function nextCursorOf(hasMore: boolean, lastRow: TrailRow | undefined) {
  if (!hasMore || !lastRow) return null
  return encodeKeysetCursor(lastRow.occurredAt, lastRow.id)
}

// The full signature log records of the page's `document.signed` entries.
async function signaturesOf(rows: TrailRow[]) {
  const ids = rows.filter((row) => row.type === SIGNED).map((row) => row.id)
  if (ids.length === 0) return new Map<string, SignatureLogRecord>()
  const records = await signatureJoin().where(
    inArray(documentSignatures.id, ids)
  )
  return new Map(
    records.map((record) => [record.signature.id, toLogRecord(record)])
  )
}

// The certificate must be the caller's; deleted ones still have entries.
async function assertOwnCertificate(userId: string, certificateId: string) {
  const certificate = await db.query.certificates.findFirst({
    where: { id: certificateId, userId },
  })
  assertFound(certificate, "Certificado no encontrado")
}

export const traceHandler = {
  list: async ({ context, input }: { context: Context; input: ListInput }) => {
    const userId = requireUserId(context)
    const cursor = decodeKeysetCursor(input.cursor)
    if (input.certificateId !== undefined) {
      await assertOwnCertificate(userId, input.certificateId)
    }
    const entries = trail(userId, input)
    const filters = trailFilters(input)

    const page = db
      .select({
        id: entries.id,
        type: entries.type,
        occurredAt: entries.occurredAt,
        ipAddress: entries.ipAddress,
        details: entries.details,
        documentId: entries.documentId,
        documentName: documents.name,
        documentDeletedAt: documents.deletedAt,
        certificateId: entries.certificateId,
        certificateAlias: certificates.alias,
        certificateHolder: certificates.commonName,
        certificateDeletedAt: certificates.deletedAt,
        versionId: entries.versionId,
        versionNumber: documentVersions.number,
        versionDeletedAt: documentVersions.deletedAt,
      })
      .from(entries)
      .leftJoin(documents, eq(documents.id, entries.documentId))
      .leftJoin(certificates, eq(certificates.id, entries.certificateId))
      .leftJoin(documentVersions, eq(documentVersions.id, entries.versionId))
      .$dynamic()
    const total = db
      .select({ total: count() })
      .from(entries)
      .leftJoin(documents, eq(documents.id, entries.documentId))
      .leftJoin(certificates, eq(certificates.id, entries.certificateId))
      .where(and(...filters))

    const {
      page: rows,
      hasMore,
      lastRow,
      total: matching,
    } = await paginateWithTotal(
      withKeysetPagination(page, {
        orderColumns: [entries.occurredAt, entries.id],
        cursor,
        filters,
        limit: input.limit + 1,
      }),
      total,
      input.limit
    )
    const signatures = await signaturesOf(rows)

    return {
      entries: rows.map((row) => toEntry(row, signatures)),
      total: matching,
      nextCursor: nextCursorOf(hasMore, lastRow),
    }
  },

  certificates: async ({ context }: { context: Context }) => {
    const userId = requireUserId(context)
    const rows = await db
      .select({
        id: certificates.id,
        alias: certificates.alias,
        holder: certificates.commonName,
        deletedAt: certificates.deletedAt,
      })
      .from(certificates)
      .where(eq(certificates.userId, userId))
      .orderBy(asc(certificates.alias), asc(certificates.id))
    return rows.map((row) => ({
      id: row.id,
      alias: row.alias,
      holder: row.holder,
      deleted: row.deletedAt !== null,
    }))
  },
}
