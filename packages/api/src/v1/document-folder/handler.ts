import { db } from "@nonete/db"
import {
  type DocumentFolder,
  documentFolders,
  documents,
  user,
} from "@nonete/db/schema"
import { and, asc, eq, isNull, sql } from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { requireUserId } from "#shared/caller"
import { toIso } from "#shared/dates"
import { isUniqueViolation } from "#shared/db-errors"
import { cleanLabel, sameLabel } from "#shared/labels"
import { assertFound } from "#shared/not-found"
import { DOCUMENT_FOLDER_ENTITY_TYPE } from "#v1/document-folder/icon-target"
import type { documentFolderInput } from "#v1/document-folder/input"
import type {
  DocumentFolderOutput,
  ListedDocumentFolder,
} from "#v1/document-folder/output"
import {
  childrenOf,
  depthOf,
  type FolderNode,
  freeName,
  isSelfOrDescendant,
  MAX_FOLDER_DEPTH,
  subtreeHeight,
} from "#v1/document-folder/tree"
import { deleteEntityIcons } from "#v1/entity-icon/handler"

const NOT_FOUND_MESSAGE = "Carpeta no encontrada"
const DUPLICATE_MESSAGE = "Ya hay una carpeta con ese nombre en ese sitio"
const TOO_DEEP_MESSAGE = `Las carpetas no pueden tener más de ${MAX_FOLDER_DEPTH} niveles`

type Executor = Pick<typeof db, "select" | "update" | "insert" | "delete">

function toFolder(row: DocumentFolder): DocumentFolderOutput {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

function cleanName(name: string) {
  const clean = cleanLabel(name)
  if (clean === "") {
    throw errors.BAD_REQUEST({
      message: "El nombre de la carpeta no puede estar vacío",
    })
  }
  return clean
}

function requireFolder(folders: DocumentFolder[], id: string) {
  return assertFound(
    folders.find((folder) => folder.id === id),
    NOT_FOUND_MESSAGE
  )
}

function assertFreeName(
  folders: FolderNode[],
  parentId: string | null,
  name: string,
  exceptId?: string
) {
  const clash = childrenOf(folders, parentId).some(
    (folder) => folder.id !== exceptId && sameLabel(folder.name, name)
  )
  if (clash) throw errors.CONFLICT({ message: DUPLICATE_MESSAGE })
}

// A race past the in-memory check still lands on the unique index.
async function orConflict<T>(write: () => Promise<T>) {
  try {
    return await write()
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.CONFLICT({ message: DUPLICATE_MESSAGE })
    }
    throw error
  }
}

/**
 * Runs a tree write in a transaction that first locks the owner's user row,
 * so two concurrent moves can't each pass the cycle check and build a loop,
 * then hands it every folder of the owner.
 */
function treeWrite<T>(
  userId: string,
  work: (tx: Executor, folders: DocumentFolder[]) => Promise<T>
) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for("update")
    const folders = await tx.query.documentFolders.findMany({
      where: { userId },
    })
    return work(tx, folders)
  })
}

export const documentFolderHandler = {
  list: async ({ context }: { context: Context }) => {
    const userId = requireUserId(context)
    const counts = db
      .select({
        folderId: documents.folderId,
        documentCount: sql<number>`count(*)::int`.as("document_count"),
      })
      .from(documents)
      .where(and(eq(documents.userId, userId), isNull(documents.deletedAt)))
      .groupBy(documents.folderId)
      .as("folder_counts")

    const rows = await db
      .select({ folder: documentFolders, documentCount: counts.documentCount })
      .from(documentFolders)
      .leftJoin(counts, eq(counts.folderId, documentFolders.id))
      .where(eq(documentFolders.userId, userId))
      .orderBy(
        asc(sql`lower(${documentFolders.name})`),
        asc(documentFolders.id)
      )

    return rows.map(
      (row): ListedDocumentFolder => ({
        ...toFolder(row.folder),
        documentCount: row.documentCount ?? 0,
      })
    )
  },

  create: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentFolderInput.create>
  }) => {
    const userId = requireUserId(context)
    const name = cleanName(input.name)
    const parentId = input.parentId ?? null
    return treeWrite(userId, async (tx, folders) => {
      if (parentId !== null) requireFolder(folders, parentId)
      if (depthOf(folders, parentId) + 1 > MAX_FOLDER_DEPTH) {
        throw errors.CONFLICT({ message: TOO_DEEP_MESSAGE })
      }
      assertFreeName(folders, parentId, name)
      const [row] = await orConflict(() =>
        tx
          .insert(documentFolders)
          .values({ userId, parentId, name })
          .returning()
      )
      if (!row) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Folder insert returned no row",
        })
      }
      return toFolder(row)
    })
  },

  rename: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentFolderInput.rename>
  }) => {
    const userId = requireUserId(context)
    const name = cleanName(input.name)
    return treeWrite(userId, async (tx, folders) => {
      const folder = requireFolder(folders, input.id)
      assertFreeName(folders, folder.parentId, name, folder.id)
      const [row] = await orConflict(() =>
        tx
          .update(documentFolders)
          .set({ name })
          .where(eq(documentFolders.id, folder.id))
          .returning()
      )
      return toFolder(assertFound(row, NOT_FOUND_MESSAGE))
    })
  },

  move: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentFolderInput.move>
  }) => {
    const userId = requireUserId(context)
    return treeWrite(userId, async (tx, folders) => {
      const folder = requireFolder(folders, input.id)
      if (input.parentId !== null) {
        requireFolder(folders, input.parentId)
        if (isSelfOrDescendant(folders, input.parentId, folder.id)) {
          throw errors.BAD_REQUEST({
            message: "Una carpeta no puede moverse dentro de sí misma",
          })
        }
      }
      if (input.parentId === folder.parentId) return toFolder(folder)

      const deepest =
        depthOf(folders, input.parentId) + subtreeHeight(folders, folder.id)
      if (deepest > MAX_FOLDER_DEPTH) {
        throw errors.CONFLICT({ message: TOO_DEEP_MESSAGE })
      }
      assertFreeName(folders, input.parentId, folder.name, folder.id)
      const [row] = await orConflict(() =>
        tx
          .update(documentFolders)
          .set({ parentId: input.parentId })
          .where(eq(documentFolders.id, folder.id))
          .returning()
      )
      return toFolder(assertFound(row, NOT_FOUND_MESSAGE))
    })
  },

  delete: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof documentFolderInput.delete>
  }) => {
    const userId = requireUserId(context)
    return treeWrite(userId, async (tx, folders) => {
      const folder = requireFolder(folders, input.id)

      // Subfolders move up next to the folder's siblings; a clash gets the
      // first free ` (n)` suffix.
      const taken = childrenOf(folders, folder.parentId)
        .filter((sibling) => sibling.id !== folder.id)
        .map((sibling) => sibling.name)
      for (const child of childrenOf(folders, folder.id)) {
        const name = freeName(taken, child.name)
        taken.push(name)
        await tx
          .update(documentFolders)
          .set({ parentId: folder.parentId, name })
          .where(eq(documentFolders.id, child.id))
      }

      // Deleted documents move too, so no row keeps pointing at the folder.
      await tx
        .update(documents)
        .set({ folderId: folder.parentId })
        .where(
          and(eq(documents.userId, userId), eq(documents.folderId, folder.id))
        )
      await deleteEntityIcons(
        { entityType: DOCUMENT_FOLDER_ENTITY_TYPE, entityIds: [folder.id] },
        tx
      )
      await tx.delete(documentFolders).where(eq(documentFolders.id, folder.id))
      return { id: folder.id, success: true }
    })
  },
}
