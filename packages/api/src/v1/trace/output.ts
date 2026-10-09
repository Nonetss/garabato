import { z } from "zod"

import {
  signatureLogCertificate,
  signatureLogRecord,
} from "#v1/document/output"

const documentRef = z
  .object({
    id: z.uuid(),
    name: z.string().describe("The document's current name"),
    deleted: z.boolean(),
  })
  .nullable()
  .describe("The document the entry is about; null for certificate entries")

const certificateRef = z
  .object({
    id: z.uuid(),
    alias: z.string(),
    holder: z.string(),
    deleted: z.boolean(),
  })
  .nullable()
  .describe(
    "The certificate the entry is about; null for most document entries"
  )

const versionRef = z
  .object({ id: z.uuid(), number: z.number().int() })
  .nullable()
  .describe("The version the action produced or delivered")

const folderRef = z
  .object({ id: z.uuid(), name: z.string() })
  .nullable()
  .describe("A folder as named when the trace was written; null is the root")

const common = {
  id: z.uuid(),
  occurredAt: z.string(),
  ipAddress: z.string().nullable(),
  document: documentRef,
  certificate: certificateRef,
  version: versionRef,
}

const plainEntry = z.object({
  ...common,
  type: z.enum([
    "certificate.imported",
    "certificate.passwordRemembered",
    "certificate.passwordForgotten",
    "certificate.deleted",
    "document.uploaded",
    "document.pagesEdited",
    "document.downloaded",
    "document.deleted",
  ]),
  details: z.null(),
})

const renameEntry = z.object({
  ...common,
  type: z.enum(["certificate.renamed", "document.renamed"]),
  details: z.object({
    from: z.string().describe("Previous name or alias"),
    to: z.string().describe("New name or alias"),
  }),
})

const moveEntry = z.object({
  ...common,
  type: z.literal("document.moved"),
  details: z.object({ from: folderRef, to: folderRef }),
})

const mergeEntry = z.object({
  ...common,
  type: z.literal("document.merged"),
  details: z.object({
    sources: z
      .array(z.object({ id: z.uuid(), name: z.string() }))
      .describe("The merged documents in merge order, as then named"),
  }),
})

const signedEntry = z.object({
  ...common,
  type: z.literal("document.signed"),
  details: z.null(),
  signature: signatureLogRecord,
})

const trailEntry = z.discriminatedUnion("type", [
  plainEntry,
  renameEntry,
  moveEntry,
  mergeEntry,
  signedEntry,
])

export type TrailEntry = z.infer<typeof trailEntry>
export type TrailCommon = z.infer<z.ZodObject<typeof common>>

export const traceOutput = {
  list: z.object({
    entries: z.array(trailEntry).describe("Newest first"),
    total: z
      .number()
      .int()
      .nonnegative()
      .describe("Entries matching the filters, across every page"),
    nextCursor: z.string().nullable(),
  }),
  certificates: z.array(signatureLogCertificate),
}
