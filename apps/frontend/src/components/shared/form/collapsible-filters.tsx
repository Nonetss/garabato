import { getIcon } from "@/lib/icon-registry"

const FilterX = getIcon("views", "clearFilters")
const SlidersHorizontal = getIcon("views", "filters")

import { Children, type ReactNode, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Static lookup so Tailwind sees the full class names — a template literal
 * like `@lg:grid-cols-${columns}` would never make it into the build.
 * Container variants: the fields follow the panel's own width, not the
 * viewport.
 */
const columnsClass: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 @lg:grid-cols-2",
  3: "grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3",
}

/** One labelled control inside a `CollapsibleFilters` grid. */
export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

/**
 * Collapsed-by-default filter panel: a "Filtros" row that expands into a grid
 * of controls, with an active-filter counter and a clear button. Callers own
 * the filter state and pass the controls as `FilterField` children.
 */
export function CollapsibleFilters({
  title = "Filtros",
  activeCount = 0,
  onClear,
  clearLabel = "Limpiar filtros",
  columns = 3,
  count,
  defaultOpen = false,
  children,
  className,
}: {
  title?: string
  activeCount?: number
  onClear?: () => void
  clearLabel?: string
  columns?: 1 | 2 | 3
  count?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [expanded, setExpanded] = useState(defaultOpen)
  const hasActive = activeCount > 0
  const fieldCount = Math.min(3, Math.max(1, Children.count(children)))
  const effectiveColumns = Math.min(columns, fieldCount) as 1 | 2 | 3

  return (
    <div className={cn("space-y-3", className)}>
      <Accordion
        value={expanded ? ["filters"] : []}
        onValueChange={(value) => setExpanded(value.includes("filters"))}
      >
        <AccordionItem value="filters" className="border-b-0">
          <AccordionTrigger className="min-h-11 py-2 hover:no-underline">
            <span className="flex min-w-0 items-center gap-2 font-medium text-sm">
              <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
              {title}
              {hasActive ? (
                <Text
                  variant="compact"
                  tone="muted"
                  className="font-normal tabular-nums"
                >
                  {activeCount} {activeCount === 1 ? "activo" : "activos"}
                </Text>
              ) : null}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="@container space-y-3">
              <div
                className={cn(
                  "grid min-w-0 gap-3",
                  columnsClass[effectiveColumns]
                )}
              >
                {children}
              </div>
              {hasActive && onClear ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={onClear}
                  >
                    <FilterX className="size-4" />
                    {clearLabel}
                  </Button>
                </div>
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {count ? (
        <Text as="p" variant="compact" tone="muted">
          {count}
        </Text>
      ) : null}
    </div>
  )
}
