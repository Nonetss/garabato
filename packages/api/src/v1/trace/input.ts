import { TRACE_TYPES } from "@nonete/db/schema"
import { z } from "zod"

import { paginationCursor, paginationLimit } from "#shared/pagination"

/** Every entry type of the trail: the stored traces plus the signatures. */
export const TRAIL_TYPES = [...TRACE_TYPES, "document.signed"] as const

export type TrailType = (typeof TRAIL_TYPES)[number]

const trailTypes = z.array(z.enum(TRAIL_TYPES)).max(TRAIL_TYPES.length)

export const traceInput = {
  list: z
    .object({
      limit: paginationLimit(25, 100),
      cursor: paginationCursor(),
      types: trailTypes
        .optional()
        .describe("Only entries of these types; every type when omitted"),
      excludedTypes: trailTypes
        .optional()
        .describe("Entries of these types are left out"),
      certificateId: z
        .uuid()
        .optional()
        .describe(
          "Only entries about this certificate, its signatures included"
        ),
      query: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .optional()
        .describe(
          "Text the document name or the certificate alias contains (case-insensitive)"
        ),
      from: z.iso
        .datetime({ offset: true })
        .optional()
        .describe("Only entries at or after this instant"),
      before: z.iso
        .datetime({ offset: true })
        .optional()
        .describe("Only entries strictly before this instant"),
    })
    .refine(
      (input) =>
        !input.types?.some((type) => input.excludedTypes?.includes(type)),
      "A type cannot be included and excluded at once"
    )
    .refine(
      (input) =>
        input.from === undefined ||
        input.before === undefined ||
        new Date(input.from) < new Date(input.before),
      "from must be before before"
    ),
}
