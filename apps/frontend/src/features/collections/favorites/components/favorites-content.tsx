import { getIcon } from "@/lib/icon-registry"

const Star = getIcon("collections", "favorite")

import { QueryState } from "@/components/shared/feedback/query-state"
import { PageHero } from "@/components/shared/layout/page-hero"
import { PageShell } from "@/components/shared/layout/page-shell"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/features/collections/favorites/components/favorite-button"
import { useFavorites } from "@/features/collections/favorites/hooks/use-favorites"
import { SavedResourceList } from "@/features/collections/shared/components/saved-resource-list"

export function FavoritesContent() {
  const favorites = useFavorites()

  return (
    <PageShell maxWidth="6xl">
      <div className="flex min-h-0 flex-1 flex-col gap-8">
        <PageHero surface="collections-favorites" />
        <QueryState
          query={favorites}
          loading="Cargando favoritos..."
          error={{
            icon: <Star className="size-6" />,
            title: "No se pudieron cargar los favoritos",
            description: "Inténtalo de nuevo dentro de unos instantes.",
            action: (
              <Button variant="outline" onClick={() => favorites.refetch()}>
                Reintentar
              </Button>
            ),
          }}
        >
          {(resources) => (
            <SavedResourceList
              resources={resources}
              emptyTitle="Todavía no tienes favoritos"
              emptyDescription="Usa la estrella en cualquier recurso para guardarlo aquí."
              action={(resource) => (
                <FavoriteButton
                  entity={{
                    entityType: resource.entityType,
                    entityId: resource.entityId,
                  }}
                  favorite
                  compact
                />
              )}
            />
          )}
        </QueryState>
      </div>
    </PageShell>
  )
}
