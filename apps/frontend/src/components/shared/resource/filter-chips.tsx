import { getIcon } from "@/lib/icon-registry"

const XIcon = getIcon("controls", "x")
const ClearFiltersIcon = getIcon("views", "clearFilters")

import { textVariants } from "@/components/shared/brand/typography"
import type { ResourceFilterChip } from "@/components/shared/resource/resource-filters"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Removable chips for every active filter value, above the list at every
 * width — see list-filter-experience's "Active filters are shown as
 * removable chips". Renders nothing when there is nothing active.
 */
export function FilterChips({
  chips,
  onClear,
  className,
}: {
  chips: ResourceFilterChip[]
  onClear?: () => void
  className?: string
}) {
  if (chips.length === 0) return null

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}
    >
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className={cn(
              textVariants({ role: "compact" }),
              "inline-flex h-7 max-w-full items-center gap-1 rounded-md border pr-1 pl-2.5",
              chip.exclude
                ? "border-destructive/30 text-destructive"
                : "text-foreground"
            )}
          >
            <span className="truncate">{chip.label}</span>
            {/* The visible button is small; the `after` overlay extends its
             *  hit area to 44px for list-filter-experience's "Chip controls
             *  are accessible". */}
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={`Quitar filtro: ${chip.label}`}
              className="relative grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors after:absolute after:-inset-3 hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
      </div>
      {onClear ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground"
        >
          <ClearFiltersIcon className="size-3.5" />
          Limpiar
        </Button>
      ) : null}
    </div>
  )
}
