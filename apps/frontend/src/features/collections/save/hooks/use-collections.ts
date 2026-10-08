import type { CollectionEntityRef } from "@/features/collections/shared/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

export function collectionsListKey() {
  return orpc.v1.collection.list.key()
}

export function collectionMembershipsKey(entity?: CollectionEntityRef) {
  if (!entity) return orpc.v1.collection.itemCollections.key()
  return orpc.v1.collection.itemCollections.queryKey({ input: entity })
}

export function collectionItemsKey(collectionId?: string) {
  if (!collectionId) return orpc.v1.collection.listItems.key()
  return orpc.v1.collection.listItems.queryKey({ input: { collectionId } })
}

export function useCollections(enabled = true) {
  return useHydratedQuery({
    ...orpc.v1.collection.list.queryOptions(),
    enabled,
  })
}

export function useCollectionMemberships(entity: CollectionEntityRef | null) {
  return useHydratedQuery({
    ...orpc.v1.collection.itemCollections.queryOptions({
      input: entity ?? { entityType: "", entityId: "" },
    }),
    enabled: entity !== null,
  })
}

export function useCollectionItems(collectionId: string | null) {
  return useHydratedQuery({
    ...orpc.v1.collection.listItems.queryOptions({
      input: { collectionId: collectionId ?? "" },
    }),
    enabled: collectionId !== null,
  })
}
