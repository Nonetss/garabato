import { z } from "zod"

export const MAX_PDF_BYTES = 20 * 1024 * 1024

const id = z.uuid()

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
}
