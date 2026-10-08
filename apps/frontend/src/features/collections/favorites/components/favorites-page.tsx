import { FavoritesContent } from "@/features/collections/favorites/components/favorites-content"
import { QueryProvider } from "@/providers/query-provider"

export function FavoritesPage() {
  return (
    <QueryProvider>
      <FavoritesContent />
    </QueryProvider>
  )
}
