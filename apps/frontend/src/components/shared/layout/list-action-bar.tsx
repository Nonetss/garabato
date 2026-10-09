import { getIcon } from "@/lib/icon-registry"

const FiltersIcon = getIcon("views", "filters")

import { type ReactNode, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { useScrollDirection } from "@/hooks/use-scroll-direction"
import { cn } from "@/lib/utils"

/** `pt-3` + `h-11` + `pb-3`, matching the bar's box without the safe area. */
const OFFSET_VISIBLE = "4.25rem"

/**
 * Fixed bottom bar for list pages below the `md` breakpoint: opens the
 * filter sheet and, when the list has one, carries a sort control — see
 * list-filter-experience's "Narrow viewports filter through an action bar
 * and a bottom sheet". Hides on scroll down and reappears on scroll up so it
 * doesn't cover content while reading, and respects the device safe area so
 * it never sits under a home-indicator gesture strip.
 *
 * Publishes `--list-action-bar-offset` so the scroll-to-top button can
 * clear the bar while it is visible and drop to the corner when it hides.
 */
export function ListActionBar({
  filterCount,
  onOpenFilters,
  sortSlot,
  className,
}: {
  filterCount: number
  onOpenFilters: () => void
  sortSlot?: ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()
  const visible = useScrollDirection()

  useEffect(() => {
    const offset = isMobile && visible ? OFFSET_VISIBLE : "0px"
    document.documentElement.style.setProperty(
      "--list-action-bar-offset",
      offset
    )
    return () => {
      document.documentElement.style.removeProperty("--list-action-bar-offset")
    }
  }, [isMobile, visible])

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-background/95 pt-3 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] backdrop-blur-sm transition-transform duration-200 ease-out md:hidden",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        visible ? "translate-y-0" : "translate-y-full",
        className
      )}
    >
      <Button
        type="button"
        variant="outline"
        className="h-11 flex-1"
        onClick={onOpenFilters}
      >
        <FiltersIcon className="size-4" />
        {filterCount > 0 ? `Filtros · ${filterCount}` : "Filtros"}
      </Button>
      {sortSlot}
    </div>
  )
}
