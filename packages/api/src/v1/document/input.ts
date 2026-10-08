import { z } from "zod"

import { paginationCursor, paginationLimit } from "#shared/pagination"

export const MAX_PDF_BYTES = 20 * 1024 * 1024

const id = z.uuid()

// A batch of the caller's documents; duplicates are ignored.
const ids = z
  .array(id)
  .min(1)
  .max(100)
  .describe("1 to 100 of the caller's document ids")

const tagIds = z.array(id).max(100)

// Fractions of the page as displayed (what the browser renders), origin at
// its top-left; the server maps them to the page's own geometry.
const rect = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .describe("Stamp rectangle as fractions of the displayed page")

const appearance = z
  .discriminatedUnion("visible", [
    z.object({ visible: z.literal(false) }),
    z.object({
      visible: z.literal(true),
      page: z
        .number()
        .int()
        .min(0)
        .describe("0-based page the rectangle was drawn on"),
      pages: z
        .enum(["one", "all"])
        .describe("Stamp that page only, or every page at the same position"),
      rect,
    }),
  ])
  .describe("Invisible signature, or a visible stamp and where it goes")

export const documentInput = {
  upload: z.object({
    file: z
      .file()
      .max(MAX_PDF_BYTES)
      .describe("PDF file, at most 20 MiB, not password-protected"),
    folderId: id
      .optional()
      .describe("Folder to put it in; the library root when omitted"),
  }),

  get: z.object({ id }),

  download: z.object({
    id,
    versionNumber: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Version to download; the current one when omitted"),
  }),

  rename: z.object({
    id,
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe("New name; `.pdf` is appended when missing"),
  }),

  delete: z.object({ id }),

  deleteMany: z.object({ ids }),

  move: z.object({
    ids,
    folderId: id
      .nullable()
      .describe("Destination folder, or null for the library root"),
  }),

  updateTags: z
    .object({
      ids,
      add: tagIds.describe("Tags to add; ones already carried are kept"),
      remove: tagIds.describe("Tags to remove; ones not carried are ignored"),
    })
    .refine(
      (input) => input.add.length + input.remove.length > 0,
      "Pass at least one tag to add or remove"
    )
    .refine(
      (input) => !input.add.some((tagId) => input.remove.includes(tagId)),
      "A tag cannot be added and removed at once"
    ),

  setPinned: z.object({
    ids,
    pinned: z
      .boolean()
      .describe("Pin (keeping the first pin moment) or unpin the documents"),
  }),

  sign: z.object({
    documentId: id,
    baseVersionId: id.describe(
      "The version the user was looking at; must still be the current one"
    ),
    certificateId: id,
    password: z
      .string()
      .max(256)
      .optional()
      .describe("Certificate password; the remembered one when omitted"),
    reason: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional(),
    appearance,
  }),

  signatures: z
    .object({
      documentId: id.optional(),
      certificateId: id.optional(),
    })
    .refine(
      (input) =>
        (input.documentId === undefined) !==
        (input.certificateId === undefined),
      "Pass exactly one of documentId or certificateId"
    ),
  signatureLog: z
    .object({
      limit: paginationLimit(25, 100),
      cursor: paginationCursor(),
      certificateId: id
        .optional()
        .describe("Only records made with this certificate"),
      query: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .optional()
        .describe("Text the document name contains (case-insensitive)"),
      signedFrom: z.iso
        .datetime({ offset: true })
        .optional()
        .describe("Only records signed at or after this instant"),
      signedBefore: z.iso
        .datetime({ offset: true })
        .optional()
        .describe("Only records signed strictly before this instant"),
    })
    .refine(
      (input) =>
        input.signedFrom === undefined ||
        input.signedBefore === undefined ||
        new Date(input.signedFrom) < new Date(input.signedBefore),
      "signedFrom must be before signedBefore"
    ),
}
