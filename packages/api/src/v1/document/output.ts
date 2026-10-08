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
})

const documentSummary = z.object({
  id: z.uuid(),
  name: z.string(),
  pageCount: z.number().int(),
  sizeBytes: z.number().int().describe("Size of the current version"),
  versionCount: z.number().int(),
  signatureCount: z.number().int(),
  lastSignedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type DocumentSummary = z.infer<typeof documentSummary>
export type DocumentVersionOutput = z.infer<typeof version>
export type SignatureRecord = z.infer<typeof signatureRecord>

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
  sign: z.object({ version, signature: signatureRecord }),
  signatures: z.array(signatureRecord),
}
