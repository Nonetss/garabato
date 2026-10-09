import { z } from "zod"

const version = z.object({
  id: z.uuid(),
  number: z.number().int(),
  sizeBytes: z.number().int(),
  sha256: z.string().describe("SHA-256 of the PDF, hex"),
  createdAt: z.string(),
})

const signatureRecord = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  documentName: z.string(),
  documentDeleted: z.boolean(),
  versionId: z.uuid(),
  versionNumber: z.number().int(),
  certificateId: z.uuid(),
  certificateAlias: z.string(),
  certificateHolder: z.string(),
  signedAt: z.string(),
  visible: z.boolean(),
  pages: z.array(z.number().int()).describe("0-based pages with a stamp"),
  rect: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  reason: z.string().nullable(),
  location: z.string().nullable(),
  sha256Before: z.string(),
  sha256After: z.string(),
  ipAddress: z.string().nullable(),
  timestampedAt: z
    .string()
    .nullable()
    .describe(
      "Time asserted by the RFC 3161 timestamp (PAdES B-T); null for B-B signatures"
    ),
  timestampAuthority: z
    .string()
    .nullable()
    .describe("Name of the TSA that issued the timestamp; null for B-B"),
})

const signatureLogRecord = signatureRecord.extend({
  certificateDeleted: z.boolean(),
  certificateTaxId: z.string().nullable(),
  certificateIssuer: z.string(),
  certificateSerialNumber: z.string(),
  certificateFingerprint: z
    .string()
    .describe("SHA-256 of the certificate DER, hex"),
  certificateNotBefore: z.string(),
  certificateNotAfter: z.string(),
})

const signatureLogCertificate = z.object({
  id: z.uuid(),
  alias: z.string(),
  holder: z.string(),
  deleted: z.boolean(),
})

const documentSummary = z.object({
  id: z.uuid(),
  name: z.string(),
  pageCount: z.number().int(),
  sizeBytes: z.number().int().describe("Size of the current version"),
  versionCount: z.number().int(),
  signatureCount: z.number().int(),
  lastSignedAt: z.string().nullable(),
  folderId: z.uuid().nullable().describe("Null for the library root"),
  tagIds: z.array(z.uuid()).describe("Tags the document carries"),
  pinnedAt: z
    .string()
    .nullable()
    .describe("When the document was pinned; null when not pinned"),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const batchResult = z.object({
  ids: z.array(z.uuid()).describe("The documents changed, without duplicates"),
  success: z.boolean(),
})

export type DocumentSummary = z.infer<typeof documentSummary>
export type DocumentVersionOutput = z.infer<typeof version>
export type SignatureRecord = z.infer<typeof signatureRecord>
export type SignatureLogRecord = z.infer<typeof signatureLogRecord>
export type SignatureLogCertificate = z.infer<typeof signatureLogCertificate>

export const documentOutput = {
  upload: documentSummary,
  list: z.array(documentSummary),
  get: documentSummary.extend({
    versions: z.array(version).describe("Oldest first"),
    signatures: z.array(signatureRecord).describe("Newest first"),
  }),
  rename: documentSummary,
  download: z.file().describe("The PDF of the requested version"),
  delete: z.object({ id: z.uuid(), success: z.boolean() }),
  deleteMany: batchResult,
  move: batchResult,
  updateTags: batchResult,
  setPinned: batchResult,
  sign: z.object({ version, signature: signatureRecord }),
  signatures: z.array(signatureRecord),
  signatureLog: z.object({
    records: z.array(signatureLogRecord).describe("Newest first"),
    total: z
      .number()
      .int()
      .nonnegative()
      .describe("Records matching the filters, across every page"),
    nextCursor: z.string().nullable(),
  }),
  signatureLogCertificates: z.array(signatureLogCertificate),
}
