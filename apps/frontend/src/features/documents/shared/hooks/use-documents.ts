import type {
  DocumentSummary,
  EditPagesInput,
  MergeDocumentsInput,
  SignatureRecord,
  SignInput,
} from "@/features/documents/shared/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

const documentsListKey = orpc.v1.document.list.queryKey()
const documentKey = (id: string) =>
  orpc.v1.document.get.queryKey({ input: { id } })
// Any version of the document, so a new signature refreshes the viewer.
const downloadKey = (id: string) =>
  orpc.v1.document.download.key({ input: { id } })
const signaturesKey = orpc.v1.document.signatures.key()
// Folder and tag counts follow the documents they hold.
const foldersKey = orpc.v1.documentFolder.list.queryKey()
const tagsKey = orpc.v1.documentTag.list.queryKey()

/** Must match `.max(100)` on the backend's batch `ids`. */
const BATCH_SIZE = 100

type BatchResult = { ids: string[]; success: boolean }

/**
 * Sends `ids` in batches of 100, one after another: each batch is atomic on
 * the server, the selection as a whole is not.
 */
async function inBatches(
  ids: string[],
  call: (batch: string[]) => Promise<BatchResult>
): Promise<BatchResult> {
  const done: string[] = []
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const result = await call(ids.slice(start, start + BATCH_SIZE))
    done.push(...result.ids)
  }
  return { ids: done, success: true }
}

function patchDocuments(
  current: DocumentSummary[] | undefined,
  ids: string[],
  patch: (document: DocumentSummary) => DocumentSummary
) {
  const targets = new Set(ids)
  return current?.map((document) => {
    if (!targets.has(document.id)) return document
    return patch(document)
  })
}

export const useDocuments = () =>
  useHydratedQuery(orpc.v1.document.list.queryOptions())

export const useDocument = (id: string) =>
  useHydratedQuery(orpc.v1.document.get.queryOptions({ input: { id } }))

/** The current version's bytes, for rendering. */
export const useDocumentFile = (id: string, versionNumber?: number) =>
  useHydratedQuery({
    ...orpc.v1.document.download.queryOptions({
      input: { id, versionNumber },
    }),
    // A version never changes once stored.
    staleTime: Number.POSITIVE_INFINITY,
  })

/**
 * The current version's bytes for a library thumbnail, fetched only once the
 * thumbnail is `enabled` (scrolled near the viewport). Shares its cache entry
 * with `useDocumentFile(id)`, so opening the document reuses the download and
 * a new signature refreshes both.
 */
export const useDocumentPreviewFile = (id: string, enabled: boolean) =>
  useHydratedQuery({
    ...orpc.v1.document.download.queryOptions({ input: { id } }),
    staleTime: Number.POSITIVE_INFINITY,
    enabled,
  })

export const downloadDocumentVersion = (id: string, versionNumber?: number) =>
  orpc.v1.document.download.call(
    { id, versionNumber },
    { context: { read: true } }
  )

export const useDocumentUpload = () =>
  useOrpcMutation<DocumentSummary, { file: File; folderId?: string }>({
    mutationFn: (input) => orpc.v1.document.upload.call(input),
    success: "Documento subido",
    error: "No se pudo subir el documento",
    invalidate: [documentsListKey, foldersKey],
  })

export const useDocumentRename = () =>
  useResourceMutation<
    { id: string; name: string },
    DocumentSummary,
    DocumentSummary[]
  >({
    mutationFn: (input) => orpc.v1.document.rename.call(input),
    listKey: documentsListKey,
    applyOptimistic: (current, input) =>
      current?.map((document) => {
        if (document.id !== input.id) return document
        return { ...document, name: input.name }
      }),
    // Detail pages and signature records show the name too.
    extraInvalidate: [orpc.v1.document.get.key(), signaturesKey],
    messages: {
      success: "Documento renombrado",
      error: "No se pudo renombrar el documento",
    },
  })

export const useDocumentsMove = () =>
  useResourceMutation<
    { ids: string[]; folderId: string | null },
    BatchResult,
    DocumentSummary[]
  >({
    mutationFn: ({ ids, folderId }) =>
      inBatches(ids, (batch) =>
        orpc.v1.document.move.call({ ids: batch, folderId })
      ),
    listKey: documentsListKey,
    applyOptimistic: (current, input) =>
      patchDocuments(current, input.ids, (document) => ({
        ...document,
        folderId: input.folderId,
      })),
    extraInvalidate: [foldersKey, orpc.v1.document.get.key()],
    messages: {
      success: "Documentos movidos",
      error: "No se pudieron mover los documentos",
    },
  })

export const useDocumentsUpdateTags = () =>
  useResourceMutation<
    { ids: string[]; add: string[]; remove: string[] },
    BatchResult,
    DocumentSummary[]
  >({
    mutationFn: ({ ids, add, remove }) =>
      inBatches(ids, (batch) =>
        orpc.v1.document.updateTags.call({ ids: batch, add, remove })
      ),
    listKey: documentsListKey,
    applyOptimistic: (current, input) =>
      patchDocuments(current, input.ids, (document) => {
        const kept = document.tagIds.filter(
          (tagId) => !input.remove.includes(tagId)
        )
        const added = input.add.filter((tagId) => !kept.includes(tagId))
        return { ...document, tagIds: [...kept, ...added] }
      }),
    extraInvalidate: [tagsKey, orpc.v1.document.get.key()],
    messages: {
      success: "Etiquetas actualizadas",
      error: "No se pudieron actualizar las etiquetas",
    },
  })

export const useDocumentsSetPinned = () =>
  useResourceMutation<
    { ids: string[]; pinned: boolean },
    BatchResult,
    DocumentSummary[]
  >({
    mutationFn: ({ ids, pinned }) =>
      inBatches(ids, (batch) =>
        orpc.v1.document.setPinned.call({ ids: batch, pinned })
      ),
    listKey: documentsListKey,
    applyOptimistic: (current, input) => {
      const now = new Date().toISOString()
      return patchDocuments(current, input.ids, (document) => {
        if (!input.pinned) return { ...document, pinnedAt: null }
        // Pinning again keeps the first pin moment, like the server.
        if (document.pinnedAt !== null) return document
        return { ...document, pinnedAt: now }
      })
    },
    extraInvalidate: [orpc.v1.document.get.key()],
    messages: {
      success: "Fijados actualizados",
      error: "No se pudieron actualizar los fijados",
    },
  })

export const useDocumentsDelete = () =>
  useResourceMutation<{ ids: string[] }, BatchResult, DocumentSummary[]>({
    mutationFn: ({ ids }) =>
      inBatches(ids, (batch) =>
        orpc.v1.document.deleteMany.call({ ids: batch })
      ),
    listKey: documentsListKey,
    applyOptimistic: (current, input) =>
      current?.filter((document) => !input.ids.includes(document.id)),
    extraInvalidate: [foldersKey, tagsKey],
    messages: {
      success: "Documentos eliminados",
      error: "No se pudieron eliminar los documentos",
    },
  })

export const useDocumentDelete = () =>
  useResourceMutation<
    { id: string },
    { id: string; success: boolean },
    DocumentSummary[]
  >({
    mutationFn: (input) => orpc.v1.document.delete.call(input),
    listKey: documentsListKey,
    applyOptimistic: (current, input) =>
      current?.filter((document) => document.id !== input.id),
    extraInvalidate: [foldersKey, tagsKey],
    messages: {
      success: "Documento eliminado",
      error: "No se pudo eliminar el documento",
    },
  })

/** Stores the edited pages as the next version and reloads the viewer. */
export const useDocumentEditPages = (id: string) =>
  useOrpcMutation<{ pageCount: number }, EditPagesInput>({
    mutationFn: (input) => orpc.v1.document.editPages.call(input),
    success: "Páginas guardadas",
    error: "No se pudieron guardar las páginas",
    invalidate: [documentKey(id), downloadKey(id), documentsListKey],
  })

/** Creates a new document joining the inputs; the sources stay unchanged. */
export const useDocumentMerge = () =>
  useOrpcMutation<DocumentSummary, MergeDocumentsInput>({
    mutationFn: (input) => orpc.v1.document.merge.call(input),
    success: "Documentos unidos",
    error: "No se pudieron unir los documentos",
    invalidate: [documentsListKey, foldersKey],
  })

export const useDocumentSign = (id: string) =>
  useOrpcMutation<{ signature: SignatureRecord }, SignInput>({
    mutationFn: (input) => orpc.v1.document.sign.call(input),
    success: "Documento firmado",
    error: "No se pudo firmar el documento",
    invalidate: [
      documentKey(id),
      downloadKey(id),
      documentsListKey,
      signaturesKey,
    ],
  })
