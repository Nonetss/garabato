export { FavoriteButton } from "@/features/collections/favorites/components/favorite-button"
export { FavoritesPage } from "@/features/collections/favorites/components/favorites-page"
export {
  useAddFavorite,
  useRemoveFavorite,
} from "@/features/collections/favorites/hooks/use-favorite-mutations"
export {
  useFavoriteStatus,
  useFavoriteStatuses,
  useFavorites,
} from "@/features/collections/favorites/hooks/use-favorites"
export type {
  FavoriteEntityRef,
  FavoriteItem,
} from "@/features/collections/shared/model/types"
