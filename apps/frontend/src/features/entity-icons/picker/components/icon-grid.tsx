import { Icon } from "lucide-react"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import type { CatalogIcon } from "@/features/entity-icons/picker/model/icon-catalog"
import { cn } from "@/lib/utils"

/** Grid density per picker size; `columns` drives arrow-key navigation. */
const GRID_SIZES = {
  compact: { columns: 8, grid: "grid-cols-8 gap-1", icon: "size-5" },
  large: { columns: 10, grid: "grid-cols-10 gap-1.5", icon: "size-6" },
} as const

export type IconGridSize = keyof typeof GRID_SIZES

/** Rendering ~1,800 SVGs at once stalls the popover; grow as it scrolls. */
const PAGE_SIZE = 160

interface IconGridProps {
  icons: CatalogIcon[]
  size?: IconGridSize
  selected: string | null
  /** Text class of the selected palette color, applied to the chosen icon. */
  selectedColorClass: string
  onSelect: (name: string) => void
  /** Reports the hovered or focused icon so the picker can name it. */
  onPreview: (icon: CatalogIcon | null) => void
}

export function IconGrid({
  icons,
  size = "compact",
  selected,
  selectedColorClass,
  onSelect,
  onPreview,
}: IconGridProps) {
  const { columns, grid, icon: iconClass } = GRID_SIZES[size]
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [focusIndex, setFocusIndex] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const selectedRef = useRef(selected)
  selectedRef.current = selected

  // A new filter starts from the top with the first page; picking an icon
  // inside the same results must not jump the scroll position.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    const selectedIndex = icons.findIndex(
      (icon) => icon.name === selectedRef.current
    )
    setFocusIndex(
      selectedIndex >= 0 && selectedIndex < PAGE_SIZE ? selectedIndex : 0
    )
    gridRef.current?.parentElement?.scrollTo({ top: 0 })
  }, [icons])

  const hasMore = visibleCount < icons.length
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => count + PAGE_SIZE)
        }
      },
      { root: gridRef.current?.parentElement ?? null, rootMargin: "120px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore])

  const moveFocus = (index: number) => {
    const next = Math.max(0, Math.min(icons.length - 1, index))
    if (next >= visibleCount) setVisibleCount(next + PAGE_SIZE)
    setFocusIndex(next)
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)
        ?.focus()
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    }
    if (event.key in steps) {
      event.preventDefault()
      moveFocus(focusIndex + (steps[event.key] ?? 0))
    } else if (event.key === "Home") {
      event.preventDefault()
      moveFocus(0)
    } else if (event.key === "End") {
      event.preventDefault()
      moveFocus(icons.length - 1)
    }
  }

  return (
    <div ref={gridRef}>
      <div
        role="listbox"
        aria-label="Iconos"
        className={cn("grid", grid)}
        onMouseLeave={() => onPreview(null)}
      >
        {icons.slice(0, visibleCount).map((icon, index) => {
          const isSelected = icon.name === selected
          return (
            <button
              key={icon.name}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={icon.name}
              data-index={index}
              tabIndex={index === focusIndex ? 0 : -1}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-foreground/80 outline-none transition-colors",
                "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                isSelected && cn("bg-muted", selectedColorClass)
              )}
              onClick={() => onSelect(icon.name)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setFocusIndex(index)
                onPreview(icon)
              }}
              onMouseEnter={() => onPreview(icon)}
            >
              <Icon iconNode={icon.node} aria-hidden className={iconClass} />
            </button>
          )
        })}
      </div>
      {hasMore ? <div ref={sentinelRef} className="h-px" /> : null}
    </div>
  )
}
