import type { FavoriteEntityRef } from "@/features/collections/shared/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

export function favoritesListKey() {
  return orpc.v1.collection.listFavorites.key()
}

export function favoriteStatusesKey(entities?: FavoriteEntityRef[]) {
  if (!entities) return orpc.v1.collection.favoriteStatuses.key()
  return orpc.v1.collection.favoriteStatuses.queryKey({
    input: { entities },
  })
}

/** Must match the 100-resource limit enforced by the API. */
const FAVORITE_STATUS_BATCH_SIZE = 100

async function fetchFavoriteStatuses(entities: FavoriteEntityRef[]) {
  const requests: Promise<
    Awaited<ReturnType<typeof orpc.v1.collection.favoriteStatuses.call>>
  >[] = []

  for (
    let index = 0;
    index < entities.length;
    index += FAVORITE_STATUS_BATCH_SIZE
  ) {
    requests.push(
      orpc.v1.collection.favoriteStatuses.call(
        {
          entities: entities.slice(index, index + FAVORITE_STATUS_BATCH_SIZE),
        },
        { context: { read: true } }
      )
    )
  }

  const results = await Promise.all(requests)
  return results.flat()
}

export function useFavorites() {
  return useHydratedQuery(orpc.v1.collection.listFavorites.queryOptions())
}

export function useFavoriteStatuses(entities: FavoriteEntityRef[]) {
  return useHydratedQuery({
    queryKey: favoriteStatusesKey(entities),
    queryFn: () => fetchFavoriteStatuses(entities),
    enabled: entities.length > 0,
  })
}

export function useFavoriteStatus(entity: FavoriteEntityRef | null) {
  const entities = entity ? [entity] : []
  const query = useFavoriteStatuses(entities)
  const favorite =
    query.data?.find(
      (row) =>
        row.entityType === entity?.entityType &&
        row.entityId === entity?.entityId
    )?.favorited ?? false

  return { ...query, favorite }
}
