import { useDeferredValue, useMemo, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { IconCategoryBar } from "@/features/entity-icons/picker/components/icon-category-bar"
import { IconColorSwatches } from "@/features/entity-icons/picker/components/icon-color-swatches"
import {
  IconGrid,
  type IconGridSize,
} from "@/features/entity-icons/picker/components/icon-grid"
import { useIconCatalog } from "@/features/entity-icons/picker/hooks/use-icon-catalog"
import type { CatalogIcon } from "@/features/entity-icons/picker/model/icon-catalog"
import type { IconCategoryId } from "@/features/entity-icons/picker/model/icon-categories.generated"
import { filterIcons } from "@/features/entity-icons/picker/model/icon-search"
import { ICON_PALETTE } from "@/features/entity-icons/picker/model/palette"
import type {
  EntityIconColor,
  EntityIconValue,
} from "@/features/entity-icons/picker/model/types"
import { getIcon } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

const SearchIcon = getIcon("views", "search")

const PANEL_SIZES = {
  compact: {
    panel: "gap-3",
    search: "pl-8",
    searchIcon: "left-2.5",
    scroll: "h-64",
    skeleton: "grid-cols-8 gap-1",
    skeletonCount: 48,
    empty: "py-8",
  },
  large: {
    panel: "gap-4",
    search: "h-10 pl-9",
    searchIcon: "left-3",
    scroll: "h-[min(28rem,55vh)]",
    skeleton: "grid-cols-10 gap-1.5",
    skeletonCount: 70,
    empty: "py-12",
  },
} as const

export interface IconPickerPanelProps {
  value: EntityIconValue | null
  onChange: (value: EntityIconValue | null) => void
  categories?: readonly IconCategoryId[]
  allowColor: boolean
  defaultColor: EntityIconColor
  size: IconGridSize
  className?: string
}

/**
 * Search, categories, icon grid and colors. Shared by both `IconPicker`
 * variants, which only decide the container (popover or dialog) and size.
 * Mounted while its container is open, so the catalog loads on first open.
 */
export function IconPickerPanel({
  value,
  onChange,
  categories,
  allowColor,
  defaultColor,
  size,
  className,
}: IconPickerPanelProps) {
  const styles = PANEL_SIZES[size]
  const [term, setTerm] = useState("")
  const [activeCategory, setActiveCategory] = useState<IconCategoryId | null>(
    null
  )
  const [preview, setPreview] = useState<CatalogIcon | null>(null)
  const deferredTerm = useDeferredValue(term)
  const catalogState = useIconCatalog(true)
  const catalog = catalogState.status === "ready" ? catalogState.catalog : null
  // Lets the user pick a color before an icon; the value wins once set.
  const [draftColor, setDraftColor] = useState<EntityIconColor>(defaultColor)
  const color = allowColor ? (value?.color ?? draftColor) : defaultColor

  const allowed = useMemo(
    () => (categories ? new Set(categories) : null),
    [categories]
  )
  const offeredCategories = useMemo(
    () =>
      catalog?.categories.filter(
        (category) => !allowed || allowed.has(category.id)
      ) ?? [],
    [catalog, allowed]
  )
  const icons = useMemo(
    () =>
      catalog
        ? filterIcons(catalog.icons, {
            allowed,
            active: activeCategory,
            term: deferredTerm,
          })
        : [],
    [catalog, allowed, activeCategory, deferredTerm]
  )

  const selectIcon = (icon: string) => onChange({ icon, color })
  const selectColor = (next: EntityIconColor) => {
    setDraftColor(next)
    if (value) onChange({ ...value, color: next })
  }

  const previewIcon = preview?.name ?? value?.icon
  const previewCategories = preview
    ? catalog?.categories
        .filter((category) => preview.categories.includes(category.id))
        .map((category) => category.title)
        .join(" · ")
    : null

  return (
    <div className={cn("flex min-w-0 flex-col", styles.panel, className)}>
      <div className="relative">
        <SearchIcon
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground",
            styles.searchIcon
          )}
        />
        <Input
          autoFocus
          type="search"
          aria-label="Buscar icono"
          placeholder="Buscar icono…"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          className={styles.search}
        />
      </div>

      {offeredCategories.length > 1 ? (
        <IconCategoryBar
          categories={offeredCategories}
          active={activeCategory}
          onChange={setActiveCategory}
        />
      ) : null}

      <div className={cn("overflow-y-auto pr-1", styles.scroll)}>
        {catalogState.status === "error" ? (
          <Text
            as="p"
            variant="meta"
            tone="destructive"
            className={cn("text-center", styles.empty)}
          >
            No se pudo cargar el catálogo de iconos
          </Text>
        ) : !catalog ? (
          <div className={cn("grid", styles.skeleton)} aria-busy>
            {Array.from({ length: styles.skeletonCount }, (_, index) => (
              <Skeleton key={index} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : icons.length === 0 ? (
          <Text
            as="p"
            variant="meta"
            tone="muted"
            className={cn("text-center", styles.empty)}
          >
            Ningún icono coincide
          </Text>
        ) : (
          <IconGrid
            icons={icons}
            size={size}
            selected={value?.icon ?? null}
            selectedColorClass={ICON_PALETTE[color].text}
            onSelect={selectIcon}
            onPreview={setPreview}
          />
        )}
      </div>

      <div className="flex min-h-9 flex-col gap-0.5 border-t pt-2">
        <Text as="span" variant="data" className="truncate">
          {previewIcon ?? "Ningún icono seleccionado"}
        </Text>
        {previewCategories ? (
          <Text as="span" variant="meta-sm" tone="muted" className="truncate">
            {previewCategories}
          </Text>
        ) : null}
      </div>

      {/* The swatches never break: when the row is too narrow (the compact
          popover) the remove action wraps below them instead. */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          allowColor ? "justify-between" : "justify-end"
        )}
      >
        {allowColor ? (
          <div className="shrink-0">
            <IconColorSwatches value={color} onChange={selectColor} />
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={!value}
          onClick={() => onChange(null)}
          className={cn("ml-auto", !value && "invisible")}
        >
          Quitar icono
        </Button>
      </div>
    </div>
  )
}
