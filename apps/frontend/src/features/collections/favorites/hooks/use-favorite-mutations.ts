import {
  favoriteStatusesKey,
  favoritesListKey,
} from "@/features/collections/favorites/hooks/use-favorites"
import type { FavoriteEntityRef } from "@/features/collections/shared/model/types"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

const listKey = favoritesListKey()
const statusesKey = favoriteStatusesKey()

export function useAddFavorite() {
  return useResourceMutation({
    mutationFn: (input: FavoriteEntityRef) =>
      orpc.v1.collection.addFavorite.call(input),
    listKey,
    extraInvalidate: [statusesKey],
    messages: {
      success: "Añadido a favoritos",
      error: "No se pudo añadir a favoritos",
    },
  })
}

export function useRemoveFavorite() {
  return useResourceMutation({
    mutationFn: (input: FavoriteEntityRef) =>
      orpc.v1.collection.removeFavorite.call(input),
    listKey,
    extraInvalidate: [statusesKey],
    messages: {
      success: "Eliminado de favoritos",
      error: "No se pudo eliminar de favoritos",
    },
  })
}
