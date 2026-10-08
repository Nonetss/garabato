import type { RefObject } from "react"
import { getIcon } from "@/lib/icon-registry"

const Loader2 = getIcon("status", "loading")

/**
 * The repeated "load more" sentinel for `useInfiniteScroll` lists: an
 * intersection target that renders a spinner while the next page loads, and
 * nothing once there's no next page. Owns the `hasNextPage` visibility gate
 * itself — callers always render this, never wrap it in their own
 * conditional.
 */
export function InfiniteScrollSentinel({
  sentinelRef,
  hasNextPage,
  isFetchingNextPage,
}: {
  sentinelRef: RefObject<HTMLDivElement | null>
  hasNextPage: boolean
  isFetchingNextPage: boolean
}) {
  if (!hasNextPage) return null

  return (
    <div ref={sentinelRef} className="flex items-center justify-center py-4">
      {isFetchingNextPage ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  )
}
