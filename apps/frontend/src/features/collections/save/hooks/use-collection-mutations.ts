import {
  collectionItemsKey,
  collectionMembershipsKey,
  collectionsListKey,
} from "@/features/collections/save/hooks/use-collections"
import type { CollectionEntityRef } from "@/features/collections/shared/model/types"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

const listKey = collectionsListKey()
const membershipsKey = collectionMembershipsKey()
const itemsKey = collectionItemsKey()

export function useCreateCollection() {
  return useResourceMutation({
    mutationFn: (input: { name: string; description?: string | null }) =>
      orpc.v1.collection.create.call(input),
    listKey,
    messages: {
      success: "Colección creada",
      error: "No se pudo crear la colección",
    },
  })
}

export function useUpdateCollection() {
  return useResourceMutation({
    mutationFn: (input: {
      id: string
      name: string
      description?: string | null
    }) => orpc.v1.collection.update.call(input),
    listKey,
    messages: {
      success: "Colección actualizada",
      error: "No se pudo actualizar la colección",
    },
  })
}

export function useDeleteCollection() {
  return useResourceMutation({
    mutationFn: ({ id }: { id: string }) =>
      orpc.v1.collection.delete.call({ id }),
    listKey,
    extraInvalidate: [itemsKey, membershipsKey],
    messages: {
      success: "Colección eliminada",
      error: "No se pudo eliminar la colección",
    },
  })
}

export function useAddCollectionItem() {
  return useResourceMutation({
    mutationFn: ({
      collectionId,
      ...entity
    }: CollectionEntityRef & { collectionId: string }) =>
      orpc.v1.collection.addItem.call({ collectionId, ...entity }),
    listKey,
    extraInvalidate: [itemsKey, membershipsKey],
    messages: {
      success: "Guardado en la colección",
      error: "No se pudo guardar en la colección",
    },
  })
}

export function useUpdateCollectionItem() {
  return useResourceMutation({
    mutationFn: ({
      id,
      metadata,
    }: {
      id: string
      metadata?: Record<string, unknown>
    }) => orpc.v1.collection.updateItem.call({ id, metadata }),
    listKey,
    extraInvalidate: [
      itemsKey,
      membershipsKey,
      orpc.v1.collection.listFavorites.key(),
    ],
    messages: {
      success: "Información actualizada",
      error: "No se pudo actualizar la información",
    },
  })
}

export function useRemoveCollectionItem() {
  return useResourceMutation({
    mutationFn: ({
      collectionId,
      ...entity
    }: CollectionEntityRef & { collectionId: string }) =>
      orpc.v1.collection.removeItem.call({ collectionId, ...entity }),
    listKey,
    extraInvalidate: [itemsKey, membershipsKey],
    messages: {
      success: "Eliminado de la colección",
      error: "No se pudo eliminar de la colección",
    },
  })
}
