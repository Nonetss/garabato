import type {
  DocumentSummary,
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
  useOrpcMutation<DocumentSummary, { file: File }>({
    mutationFn: (input) => orpc.v1.document.upload.call(input),
    success: "Documento subido",
    error: "No se pudo subir el documento",
    invalidate: [documentsListKey],
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
    messages: {
      success: "Documento eliminado",
      error: "No se pudo eliminar el documento",
    },
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
