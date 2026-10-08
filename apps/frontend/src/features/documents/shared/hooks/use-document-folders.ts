import type { DocumentFolder } from "@/features/documents/shared/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

type FolderRecord = Omit<DocumentFolder, "documentCount">

export const documentFoldersKey = orpc.v1.documentFolder.list.queryKey()
const documentsListKey = orpc.v1.document.list.queryKey()

/** Every folder of the library, flat; build the tree with `folder-tree`. */
export const useDocumentFolders = () =>
  useHydratedQuery(orpc.v1.documentFolder.list.queryOptions())

export const useDocumentFolderCreate = () =>
  useOrpcMutation<FolderRecord, { name: string; parentId?: string }>({
    mutationFn: (input) => orpc.v1.documentFolder.create.call(input),
    success: "Carpeta creada",
    error: "No se pudo crear la carpeta",
    invalidate: [documentFoldersKey],
  })

export const useDocumentFolderRename = () =>
  useResourceMutation<
    { id: string; name: string },
    FolderRecord,
    DocumentFolder[]
  >({
    mutationFn: (input) => orpc.v1.documentFolder.rename.call(input),
    listKey: documentFoldersKey,
    applyOptimistic: (current, input) =>
      current?.map((folder) => {
        if (folder.id !== input.id) return folder
        return { ...folder, name: input.name }
      }),
    messages: {
      success: "Carpeta renombrada",
      error: "No se pudo renombrar la carpeta",
    },
  })

export const useDocumentFolderMove = () =>
  useResourceMutation<
    { id: string; parentId: string | null },
    FolderRecord,
    DocumentFolder[]
  >({
    mutationFn: (input) => orpc.v1.documentFolder.move.call(input),
    listKey: documentFoldersKey,
    applyOptimistic: (current, input) =>
      current?.map((folder) => {
        if (folder.id !== input.id) return folder
        return { ...folder, parentId: input.parentId }
      }),
    messages: {
      success: "Carpeta movida",
      error: "No se pudo mover la carpeta",
    },
  })

// Its documents and subfolders move up, so both lists change.
export const useDocumentFolderDelete = () =>
  useResourceMutation<
    { id: string },
    { id: string; success: boolean },
    DocumentFolder[]
  >({
    mutationFn: (input) => orpc.v1.documentFolder.delete.call(input),
    listKey: documentFoldersKey,
    applyOptimistic: (current, input) =>
      current?.filter((folder) => folder.id !== input.id),
    extraInvalidate: [documentsListKey, orpc.v1.document.get.key()],
    messages: {
      success: "Carpeta eliminada",
      error: "No se pudo eliminar la carpeta",
    },
  })
