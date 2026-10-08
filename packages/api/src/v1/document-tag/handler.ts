import { db } from "@nonete/db"
import {
  type DocumentTag,
  documents,
  documentTagAssignments,
  documentTags,
} from "@nonete/db/schema"
import { and, asc, eq, isNull, sql } from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { requireUserId } from "#shared/caller"
import { toIso } from "#shared/dates"
import { isUniqueViolation } from "#shared/db-errors"
import { cleanLabel } from "#shared/labels"
import { assertFound } from "#shared/not-found"
import type { documentTagInput } from "#v1/document-tag/input"
import type {
  DocumentTagOutput,
  ListedDocumentTag,
} from "#v1/document-tag/output"

const NOT_FOUND_MESSAGE = "Etiqueta no encontrada"

function toTag(row: DocumentTag): DocumentTagOutput {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

function cleanName(name: string) {
  const clean = cleanLabel(name)
  if (clean === "") {
    throw errors.BAD_REQUEST({
      message: "El nombre de la etiqueta no puede estar vacío",
    })
  }
  return clean
}

// The unique index on (user, lower(name)) is the only duplicate check.
async function orConflict<T>(write: () => Promise<T>) {
  try {
    return await write()
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.CONFLICT({
        message: "Ya tienes una etiqueta con ese nombre",
      })
    }
    throw error
  }
}

function owned(userId: string, id: string) {
  return and(eq(documentTags.id, id), eq(documentTags.userId, userId))
}

export const documentTagHandler = {
  list: async ({ context }: { context: Context }) => {
    const userId = requireUserId(context)
    const counts = db
      .select({
        tagId: documentTagAssignments.tagId,
        documentCount: sql<number>`count(*)::int`.as("document_count"),
      })
      .from(documentTagAssignments)
      .innerJoin(documents, eq(documents.id, documentTagAssignments.documentId))
      .where(isNull(documents.deletedAt))
      .groupBy(documentTagAssignments.tagId)
      .as("tag_counts")

    const rows = await db
      .select({ tag: documentTags, documentCount: counts.documentCount })
      .from(documentTags)
      .leftJoin(counts, eq(counts.tagId, documentTags.id))
      .where(eq(documentTags.userId, userId))
      .orderBy(asc(sql`lower(${documentTags.name})`), asc(documentTags.id))

    return rows.map(
      (row): ListedDocumentTag => ({
        ...toTag(row.tag),
        documentCount: row.documentCount ?? 0,
      })
    )
  },

  create: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentTagInput.create>
  }) => {
    const userId = requireUserId(context)
    const name = cleanName(input.name)
    const [row] = await orConflict(() =>
      db
        .insert(documentTags)
        .values({ userId, name, color: input.color ?? "neutral" })
        .returning()
    )
    if (!row) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Tag insert returned no row",
      })
    }
    return toTag(row)
  },

  update: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentTagInput.update>
  }) => {
    const userId = requireUserId(context)
    const name = input.name === undefined ? undefined : cleanName(input.name)
    const [row] = await orConflict(() =>
      db
        .update(documentTags)
        .set({
          ...(name !== undefined && { name }),
          ...(input.color !== undefined && { color: input.color }),
        })
        .where(owned(userId, input.id))
        .returning()
    )
    return toTag(assertFound(row, NOT_FOUND_MESSAGE))
  },

  // Assignments go with the foreign key's cascade.
  delete: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentTagInput.delete>
  }) => {
    const userId = requireUserId(context)
    const [row] = await db
      .delete(documentTags)
      .where(owned(userId, input.id))
      .returning({ id: documentTags.id })
    const tag = assertFound(row, NOT_FOUND_MESSAGE)
    return { id: tag.id, success: true }
  },
}
