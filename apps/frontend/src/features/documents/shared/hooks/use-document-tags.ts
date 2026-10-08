import type { DocumentTag } from "@/features/documents/shared/model/types"
import type { EntityIconColor } from "@/features/entity-icons"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

type TagRecord = Omit<DocumentTag, "documentCount">

export const documentTagsKey = orpc.v1.documentTag.list.queryKey()
const documentsListKey = orpc.v1.document.list.queryKey()

/** Every tag of the user, ordered by name, with document counts. */
export const useDocumentTags = () =>
  useHydratedQuery(orpc.v1.documentTag.list.queryOptions())

export const useDocumentTagCreate = () =>
  useOrpcMutation<TagRecord, { name: string; color?: EntityIconColor }>({
    mutationFn: (input) => orpc.v1.documentTag.create.call(input),
    success: "Etiqueta creada",
    error: "No se pudo crear la etiqueta",
    invalidate: [documentTagsKey],
  })

export const useDocumentTagUpdate = () =>
  useResourceMutation<
    { id: string; name?: string; color?: EntityIconColor },
    TagRecord,
    DocumentTag[]
  >({
    mutationFn: (input) => orpc.v1.documentTag.update.call(input),
    listKey: documentTagsKey,
    applyOptimistic: (current, input) =>
      current?.map((tag) => {
        if (tag.id !== input.id) return tag
        return {
          ...tag,
          ...(input.name !== undefined && { name: input.name }),
          ...(input.color !== undefined && { color: input.color }),
        }
      }),
    messages: {
      success: "Etiqueta actualizada",
      error: "No se pudo actualizar la etiqueta",
    },
  })

// Documents lose the tag, so their list changes too.
export const useDocumentTagDelete = () =>
  useResourceMutation<
    { id: string },
    { id: string; success: boolean },
    DocumentTag[]
  >({
    mutationFn: (input) => orpc.v1.documentTag.delete.call(input),
    listKey: documentTagsKey,
    applyOptimistic: (current, input) =>
      current?.filter((tag) => tag.id !== input.id),
    extraInvalidate: [documentsListKey, orpc.v1.document.get.key()],
    messages: {
      success: "Etiqueta eliminada",
      error: "No se pudo eliminar la etiqueta",
    },
  })
