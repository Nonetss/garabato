import { useEffect, useState } from "react"
import { Hint } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import {
  useAddFavorite,
  useRemoveFavorite,
} from "@/features/collections/favorites/hooks/use-favorite-mutations"
import { useFavoriteStatus } from "@/features/collections/favorites/hooks/use-favorites"
import type { FavoriteEntityRef } from "@/features/collections/shared/model/types"
import { getIcon } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

const Star = getIcon("collections", "favorite")

interface FavoriteButtonProps {
  entity: FavoriteEntityRef
  className?: string
  /** Accessible text and visible text when the button is not compact. */
  label?: string
  /** Uses an icon-only button for dense rows and cards. */
  compact?: boolean
  /**
   * A value supplied by a batched `useFavoriteStatuses` call. It avoids the
   * per-resource status query while keeping the button fully interactive.
   */
  favorite?: boolean
}

export function FavoriteButton({
  entity,
  className,
  label = "Favoritos",
  compact = false,
  favorite: favoriteProp,
}: FavoriteButtonProps) {
  const fetched = useFavoriteStatus(favoriteProp === undefined ? entity : null)
  const addFavorite = useAddFavorite()
  const removeFavorite = useRemoveFavorite()
  const [optimisticFavorite, setOptimisticFavorite] = useState<boolean | null>(
    null
  )
  const queriedFavorite = favoriteProp ?? fetched.favorite
  const favorite = optimisticFavorite ?? queriedFavorite
  const isPending = addFavorite.isPending || removeFavorite.isPending
  const isLoadingStatus = favoriteProp === undefined && fetched.isPending

  // Once a supplied batch value or the query catches up, use it as the source
  // of truth again instead of retaining an old optimistic value.
  useEffect(() => {
    setOptimisticFavorite(null)
  }, [queriedFavorite])

  const handleClick = async () => {
    const nextFavorite = !favorite
    setOptimisticFavorite(nextFavorite)

    try {
      if (nextFavorite) {
        await addFavorite.mutateAsync(entity)
      } else {
        await removeFavorite.mutateAsync(entity)
      }
    } catch {
      setOptimisticFavorite(null)
    }
  }

  const actionLabel = favorite ? "Quitar de favoritos" : `Añadir a ${label}`

  const button = (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      className={cn(
        "text-muted-foreground",
        favorite && "text-amber-500 hover:text-amber-600 dark:text-amber-400",
        className
      )}
      aria-label={actionLabel}
      aria-pressed={favorite}
      disabled={isPending || isLoadingStatus}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void handleClick()
      }}
    >
      <Star
        data-icon={compact ? undefined : "inline-start"}
        className={favorite ? "fill-current" : undefined}
        aria-hidden="true"
      />
      {compact ? null : <span>{favorite ? "En favoritos" : label}</span>}
    </Button>
  )

  return compact ? <Hint label={actionLabel}>{button}</Hint> : button
}
