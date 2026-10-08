import { db } from "@nonete/db"
import { comments } from "@nonete/db/schema"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { toIso, toIsoOrNull } from "#shared/dates"
import { assertFound } from "#shared/not-found"
import type { commentInput } from "#v1/comment/input"
import type { CommentNode } from "#v1/comment/output"

type Author = {
  id: string
  name: string
  email: string
  image: string | null
}

type CommentRow = {
  id: string
  content: string
  entityType: string
  entityId: string
  parentId: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  author: Author | null
}

function toCommentNode(
  row: CommentRow,
  replies: CommentNode[] = []
): CommentNode {
  if (!row.author) {
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Comment author missing",
    })
  }

  const deleted = row.deletedAt !== null
  return {
    id: row.id,
    content: deleted ? "" : row.content,
    entityType: row.entityType,
    entityId: row.entityId,
    parentId: row.parentId,
    author: {
      id: row.author.id,
      name: row.author.name,
      email: row.author.email,
      image: row.author.image,
    },
    deletedAt: toIsoOrNull(row.deletedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    replies,
  }
}

function buildTree(rows: CommentRow[]): CommentNode[] {
  const byParent = new Map<string | null, CommentRow[]>()
  for (const row of rows) {
    const key = row.parentId
    const list = byParent.get(key) ?? []
    list.push(row)
    byParent.set(key, list)
  }

  const nest = (parentId: string | null): CommentNode[] => {
    const children = byParent.get(parentId) ?? []
    return children.map((row) => toCommentNode(row, nest(row.id)))
  }

  // Soft-deleted roots with no visible replies are dropped from the tree.
  return nest(null).filter(
    (node) => node.deletedAt === null || node.replies.length > 0
  )
}

async function loadComment(id: string) {
  const row = await db.query.comments.findFirst({
    where: { id },
    with: { author: true },
  })
  return assertFound(row, "Comentario no encontrado")
}

export const commentHandler = {
  list: async ({ input }: { input: z.infer<typeof commentInput.list> }) => {
    const rows = await db.query.comments.findMany({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
      },
      with: { author: true },
      orderBy: { createdAt: "asc" },
    })

    return buildTree(rows)
  },

  counts: async ({ input }: { input: z.infer<typeof commentInput.counts> }) => {
    const entityTypes = [...new Set(input.entities.map((e) => e.entityType))]
    const entityIds = [...new Set(input.entities.map((e) => e.entityId))]

    const rows = await db
      .select({
        entityType: comments.entityType,
        entityId: comments.entityId,
        count: sql<number>`count(*)::int`,
      })
      .from(comments)
      .where(
        and(
          inArray(comments.entityType, entityTypes),
          inArray(comments.entityId, entityIds),
          isNull(comments.deletedAt)
        )
      )
      .groupBy(comments.entityType, comments.entityId)

    const countByKey = new Map(
      rows.map((row) => [`${row.entityType}:${row.entityId}`, row.count])
    )

    return input.entities.map((entity) => ({
      entityType: entity.entityType,
      entityId: entity.entityId,
      count: countByKey.get(`${entity.entityType}:${entity.entityId}`) ?? 0,
    }))
  },

  create: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof commentInput.create>
  }) => {
    if (!context.user) throw errors.UNAUTHORIZED()

    if (input.parentId) {
      const parent = await db.query.comments.findFirst({
        where: { id: input.parentId },
      })
      if (!parent || parent.deletedAt) {
        throw errors.NOT_FOUND({ message: "Comentario padre no encontrado" })
      }
      if (
        parent.entityType !== input.entityType ||
        parent.entityId !== input.entityId
      ) {
        throw errors.BAD_REQUEST({
          message: "El comentario padre pertenece a otra entidad",
        })
      }
    }

    const [inserted] = await db
      .insert(comments)
      .values({
        content: input.content,
        entityType: input.entityType,
        entityId: input.entityId,
        parentId: input.parentId ?? null,
        authorId: context.user.id,
      })
      .returning({ id: comments.id })

    if (!inserted) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "No se pudo crear el comentario",
      })
    }

    const row = await loadComment(inserted.id)
    return toCommentNode(row)
  },

  update: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof commentInput.update>
  }) => {
    if (!context.user) throw errors.UNAUTHORIZED()

    const existing = await loadComment(input.id)
    if (existing.deletedAt) {
      throw errors.NOT_FOUND({ message: "Comentario no encontrado" })
    }
    if (existing.author?.id !== context.user.id) {
      throw errors.FORBIDDEN({ message: "Solo puedes editar tus comentarios" })
    }

    await db
      .update(comments)
      .set({ content: input.content })
      .where(eq(comments.id, input.id))

    const row = await loadComment(input.id)
    return toCommentNode(row)
  },

  delete: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof commentInput.delete>
  }) => {
    if (!context.user) throw errors.UNAUTHORIZED()

    const existing = await loadComment(input.id)
    if (existing.deletedAt) {
      return { id: input.id, success: true }
    }
    if (existing.author?.id !== context.user.id) {
      throw errors.FORBIDDEN({
        message: "Solo puedes eliminar tus comentarios",
      })
    }

    await db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(eq(comments.id, input.id))

    return { id: input.id, success: true }
  },
}
