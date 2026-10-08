import { getIcon } from "@/lib/icon-registry"

const ExcludeIcon = getIcon("controls", "exclude")
const ChevronDown = getIcon("controls", "chevronDown")

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import {
  CollapsibleFilters,
  FilterField,
} from "@/components/shared/form/collapsible-filters"
import type { SuggestInputItem } from "@/components/shared/form/suggest-input"
import { SuggestInput } from "@/components/shared/form/suggest-input"
import { ListActionBar } from "@/components/shared/layout/list-action-bar"
import { FilterSheet } from "@/components/shared/resource/filter-sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export interface ResourceFilterOption {
  value: string
  label: string
  /** Optional leading icon, shown in both the option row and the trigger once selected. */
  icon?: ReactNode
}

export interface ResourceFacetOption {
  value: string
  label: string
  /** Omitted for lists that can't count options (Better Auth/Loki-backed
   *  admin lists) — the sheet/panel then renders the option without a count. */
  count?: number
}

export interface ResourceFacetValue {
  include: string[]
  exclude: string[]
}

interface ResourceFilterBase {
  key: string
  label: string
}

export type ResourceFilterDescriptor =
  | (ResourceFilterBase & {
      kind: "search"
      value: string
      onChange: (value: string) => void
      placeholder?: string
      /** Value that means "no filter" — what clearing this field's chip
       *  resets to. Defaults to `""`. */
      defaultValue?: string
      /** Defaults to `value !== (defaultValue ?? "")`. */
      isActive?: (value: string) => boolean
    })
  | (ResourceFilterBase & {
      kind: "suggestion"
      value: string
      onChange: (value: string) => void
      onSuggestionSelect?: (value: string) => void
      suggestions: SuggestInputItem[]
      isLoading?: boolean
      placeholder?: string
      /** Value that means "no filter" — what clearing this field's chip
       *  resets to. Defaults to `""`. */
      defaultValue?: string
      /** Defaults to `value !== (defaultValue ?? "")`. */
      isActive?: (value: string) => boolean
    })
  | (ResourceFilterBase & {
      kind: "select"
      value: string
      onChange: (value: string) => void
      options: ResourceFilterOption[]
      placeholder?: string
      /** Value that means "no filter" — what clearing this field's chip
       *  resets to. Defaults to `""`. */
      defaultValue?: string
      /** Defaults to `value !== (defaultValue ?? "")`. */
      isActive?: (value: string) => boolean
    })
  | (ResourceFilterBase & {
      kind: "date"
      value: Date | undefined
      onChange: (value: Date | undefined) => void
      placeholder?: string
      /** Defaults to `value !== undefined`. */
      isActive?: (value: Date | undefined) => boolean
    })
  | (ResourceFilterBase & {
      kind: "facet"
      options: ResourceFacetOption[]
      value: ResourceFacetValue
      onChange: (value: ResourceFacetValue) => void
      isLoading?: boolean
      /** Set `false` for a dimension the list can only filter by inclusion
       *  (e.g. containing network) — hides the per-option exclude control
       *  rather than offering an action nothing on the server honors. */
      excludable?: boolean
    })
  | (ResourceFilterBase & {
      kind: "custom"
      /** Custom controls own their active state — the shared renderer can't infer it from an opaque `render()`. */
      isActive: boolean
      render: () => ReactNode
    })

function isFilterActive(filter: ResourceFilterDescriptor): boolean {
  switch (filter.kind) {
    case "search":
    case "suggestion":
    case "select":
      return filter.isActive
        ? filter.isActive(filter.value)
        : filter.value !== (filter.defaultValue ?? "")
    case "date":
      return filter.isActive
        ? filter.isActive(filter.value)
        : filter.value !== undefined
    case "facet":
      return filter.value.include.length > 0 || filter.value.exclude.length > 0
    case "custom":
      return filter.isActive
  }
}

const FACET_SEARCH_THRESHOLD = 8

/** Puts `value` in the include set, removing it from exclude — the absolute
 *  action a `FilterableValue`'s "Filtrar por esto" performs, as opposed to
 *  toggling from whatever the current state happens to be. */
export function includeFacetValue(
  current: ResourceFacetValue,
  value: string
): ResourceFacetValue {
  return {
    include: current.include.includes(value)
      ? current.include
      : [...current.include, value],
    exclude: current.exclude.filter((v) => v !== value),
  }
}

/** The exclude counterpart of `includeFacetValue` — a `FilterableValue`'s
 *  "Excluir" action. */
export function excludeFacetValue(
  current: ResourceFacetValue,
  value: string
): ResourceFacetValue {
  return {
    include: current.include.filter((v) => v !== value),
    exclude: current.exclude.includes(value)
      ? current.exclude
      : [...current.exclude, value],
  }
}

/** Toggles `value` in a set field: cycles unselected → included → excluded →
 *  unselected, so an option is never in both sets at once — the option-list
 *  checkbox/ban-button behavior, as opposed to `FilterableValue`'s absolute
 *  include/exclude actions above. */
function toggleFacetValue(
  current: ResourceFacetValue,
  value: string,
  next: "include" | "exclude"
): ResourceFacetValue {
  const alreadySet = current[next].includes(value)
  if (alreadySet) {
    return next === "include"
      ? {
          include: current.include.filter((v) => v !== value),
          exclude: current.exclude,
        }
      : {
          include: current.include,
          exclude: current.exclude.filter((v) => v !== value),
        }
  }
  return next === "include"
    ? includeFacetValue(current, value)
    : excludeFacetValue(current, value)
}

/**
 * Checkable option list for a `facet` descriptor: a checkbox includes an
 * option, the ban button excludes it: this is the shared control both the
 * inline panel and the filter sheet render for a facet section. Options
 * beyond `FACET_SEARCH_THRESHOLD` get a text box to narrow them by label.
 */
export function FacetOptionsList({
  filter,
}: {
  filter: ResourceFilterDescriptor & { kind: "facet" }
}) {
  const [search, setSearch] = useState("")
  const needsSearch = filter.options.length > FACET_SEARCH_THRESHOLD
  const visible = useMemo(() => {
    if (!needsSearch || search === "") return filter.options
    const folded = search.trim().toLowerCase()
    return filter.options.filter((option) =>
      option.label.toLowerCase().includes(folded)
    )
  }, [filter.options, needsSearch, search])

  return (
    <div className="space-y-2">
      {needsSearch ? (
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Buscar en ${filter.label.toLowerCase()}…`}
          aria-label={`Buscar opción de ${filter.label}`}
          className="h-9"
        />
      ) : null}
      <TooltipProvider delay={300}>
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {visible.map((option) => {
            const included = filter.value.include.includes(option.value)
            const excluded = filter.value.exclude.includes(option.value)
            const zeroCount = option.count === 0 && !included && !excluded
            return (
              <li
                key={option.value}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-md px-1.5",
                  zeroCount && "opacity-50"
                )}
              >
                <Checkbox
                  id={`${filter.key}-${option.value}`}
                  checked={included}
                  onCheckedChange={() =>
                    filter.onChange(
                      toggleFacetValue(filter.value, option.value, "include")
                    )
                  }
                  aria-label={`Incluir ${option.label}`}
                />
                <label
                  htmlFor={`${filter.key}-${option.value}`}
                  className={cn(
                    "min-w-0 flex-1 cursor-pointer truncate text-sm",
                    excluded && "text-destructive line-through"
                  )}
                >
                  {option.label}
                </label>
                {option.count !== undefined ? (
                  <Text variant="data" tone="muted" className="shrink-0">
                    {option.count}
                  </Text>
                ) : null}
                {filter.excludable === false ? null : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant={excluded ? "destructive" : "ghost"}
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Excluir ${option.label}`}
                          aria-pressed={excluded}
                          onClick={() =>
                            filter.onChange(
                              toggleFacetValue(
                                filter.value,
                                option.value,
                                "exclude"
                              )
                            )
                          }
                        />
                      }
                    >
                      <ExcludeIcon className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {excluded
                        ? `Dejar de excluir ${option.label}`
                        : `Excluir: oculta los resultados con ${option.label}`}
                    </TooltipContent>
                  </Tooltip>
                )}
              </li>
            )
          })}
          {visible.length === 0 ? (
            <Text as="li" variant="meta" tone="muted" className="px-1.5 py-2">
              Sin opciones
            </Text>
          ) : null}
        </ul>
      </TooltipProvider>
    </div>
  )
}

/** One-line summary of a facet's selection for its popover trigger: "Todos"
 *  when nothing is set, otherwise the first selected label plus how many
 *  more — excluded options read "no <label>". */
function facetSummary(
  filter: ResourceFilterDescriptor & { kind: "facet" }
): string | undefined {
  const labelOf = (value: string) =>
    filter.options.find((option) => option.value === value)?.label ?? value
  const parts = [
    ...filter.value.include.map(labelOf),
    ...filter.value.exclude.map((value) => `no ${labelOf(value)}`),
  ]
  if (parts.length === 0) return undefined
  return parts.length === 1 ? parts[0] : `${parts[0]} +${parts.length - 1}`
}

/**
 * Wide-viewport control for a `facet` descriptor: an input-sized trigger
 * summarizing the selection that opens the option list in a popover, so a
 * dimension with dozens of options takes one grid row in the inline panel
 * instead of a scrolling list. Changes still apply immediately.
 */
function FacetFilterPopover({
  filter,
}: {
  filter: ResourceFilterDescriptor & { kind: "facet" }
}) {
  const summary = facetSummary(filter)
  const excludedOnly =
    filter.value.include.length === 0 && filter.value.exclude.length > 0

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            aria-label={`Filtrar por ${filter.label}`}
          />
        }
      >
        <span
          className={cn(
            "min-w-0 truncate",
            summary === undefined && "text-muted-foreground",
            excludedOnly && "text-destructive"
          )}
        >
          {summary ?? "Todos"}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-72 p-2">
        <FacetOptionsList filter={filter} />
      </PopoverContent>
    </Popover>
  )
}

function renderFilterControl(filter: ResourceFilterDescriptor): ReactNode {
  switch (filter.kind) {
    case "search":
      return (
        <Input
          id={filter.key}
          value={filter.value}
          onChange={(event) => filter.onChange(event.target.value)}
          placeholder={filter.placeholder}
          className="w-full"
        />
      )
    case "suggestion":
      return (
        <SuggestInput
          id={filter.key}
          value={filter.value}
          onValueChange={filter.onChange}
          onSuggestionSelect={filter.onSuggestionSelect}
          suggestions={filter.suggestions}
          isLoading={filter.isLoading}
          placeholder={filter.placeholder}
          className="w-full"
        />
      )
    case "select":
      return (
        <Select
          items={filter.options}
          value={filter.value}
          onValueChange={(value) => filter.onChange(value ?? "")}
        >
          <SelectTrigger id={filter.key} className="w-full">
            <SelectValue placeholder={filter.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                label={option.label}
              >
                {option.icon}
                <span className="truncate">{option.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case "date":
      return (
        <DatePicker
          value={filter.value}
          onChange={filter.onChange}
          placeholder={filter.placeholder}
          className="w-full"
          aria-label={filter.label}
        />
      )
    case "facet":
      return <FacetOptionsList filter={filter} />
    case "custom":
      return filter.render()
  }
}

export interface ResourceFilterChip {
  key: string
  label: string
  exclude?: boolean
  onRemove: () => void
}

/** Derives removable chip descriptors from every active filter's current
 *  value — one chip per active single-value filter (as `isActive` reports
 *  it; removing the chip resets it to `defaultValue`), one per included and
 *  one per excluded facet option. `custom` descriptors own opaque values, so
 *  callers append their chips by hand. */
export function chipsFor(
  filters: ResourceFilterDescriptor[]
): ResourceFilterChip[] {
  const chips: ResourceFilterChip[] = []

  for (const filter of filters) {
    switch (filter.kind) {
      case "search":
      case "suggestion":
        if (isFilterActive(filter)) {
          chips.push({
            key: filter.key,
            label: `${filter.label}: ${filter.value}`,
            onRemove: () => filter.onChange(filter.defaultValue ?? ""),
          })
        }
        break
      case "select":
        if (isFilterActive(filter)) {
          const option = filter.options.find((o) => o.value === filter.value)
          chips.push({
            key: filter.key,
            label: `${filter.label}: ${option?.label ?? filter.value}`,
            onRemove: () => filter.onChange(filter.defaultValue ?? ""),
          })
        }
        break
      case "date":
        if (filter.value !== undefined && isFilterActive(filter)) {
          chips.push({
            key: filter.key,
            label: `${filter.label}: ${filter.value.toLocaleDateString()}`,
            onRemove: () => filter.onChange(undefined),
          })
        }
        break
      case "facet":
        for (const value of filter.value.include) {
          const option = filter.options.find((o) => o.value === value)
          chips.push({
            key: `${filter.key}:${value}`,
            label: `${filter.label}: ${option?.label ?? value}`,
            onRemove: () =>
              filter.onChange({
                include: filter.value.include.filter((v) => v !== value),
                exclude: filter.value.exclude,
              }),
          })
        }
        for (const value of filter.value.exclude) {
          const option = filter.options.find((o) => o.value === value)
          chips.push({
            key: `${filter.key}:!${value}`,
            label: `${filter.label}: no ${option?.label ?? value}`,
            exclude: true,
            onRemove: () =>
              filter.onChange({
                include: filter.value.include,
                exclude: filter.value.exclude.filter((v) => v !== value),
              }),
          })
        }
        break
      case "custom":
        break
    }
  }

  return chips
}

function filterHtmlFor(filter: ResourceFilterDescriptor) {
  return filter.kind === "custom" || filter.kind === "facet"
    ? undefined
    : filter.key
}

/** One labelled field per descriptor, stacked — the layout `FilterSheet`
 *  renders its sections with, and the piece `ResourceFilters`' inline grid
 *  wraps for wide viewports. Facet sections collapse into an accordion
 *  (open by default only when already active): a sheet with several
 *  option-list dimensions is otherwise an uncomfortable amount of scrolling
 *  on a phone. */
export function ResourceFilterFields({
  filters,
  className,
}: {
  filters: ResourceFilterDescriptor[]
  className?: string
}) {
  const plainFilters = filters.filter((filter) => filter.kind !== "facet")
  const facetFilters = filters.filter(
    (filter): filter is ResourceFilterDescriptor & { kind: "facet" } =>
      filter.kind === "facet"
  )
  const openByDefault = facetFilters
    .filter(
      (filter) =>
        filter.value.include.length > 0 || filter.value.exclude.length > 0
    )
    .map((filter) => filter.key)

  return (
    <div className={cn("space-y-4", className)}>
      {plainFilters.map((filter) => (
        <FilterField
          key={filter.key}
          label={filter.label}
          htmlFor={filterHtmlFor(filter)}
        >
          {renderFilterControl(filter)}
        </FilterField>
      ))}
      {facetFilters.length > 0 ? (
        <Accordion defaultValue={openByDefault}>
          {facetFilters.map((filter) => {
            const activeCount =
              filter.value.include.length + filter.value.exclude.length
            return (
              <AccordionItem key={filter.key} value={filter.key}>
                <AccordionTrigger className="py-2.5">
                  <span className="flex items-center gap-2">
                    {filter.label}
                    {activeCount > 0 ? (
                      <Text variant="compact" tone="muted">
                        {activeCount}
                      </Text>
                    ) : null}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-2.5">
                  <FacetOptionsList filter={filter} />
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      ) : null}
    </div>
  )
}

/**
 * Discriminated-descriptor filter surface: pass typed field descriptors and
 * the shared layer derives labels, active count, the control markup and the
 * responsive layout. Persistence (`useState`, `useQueryParam`) and
 * record-matching stay in the feature hook — this component only renders
 * controls and reports which ones are active.
 *
 * At and above the `md` breakpoint this is the existing inline
 * `CollapsibleFilters` panel, applying every change immediately; `facet`
 * descriptors render there as `FacetFilterPopover` triggers. Below it,
 * filters move into `ListActionBar` + `FilterSheet`: non-facet descriptors
 * (search/suggestion/select/date) keep applying immediately as the user
 * edits them in the sheet, while `facet` descriptors are edited as a local
 * draft that only reaches the caller's `onChange` when the sheet's confirm
 * button is pressed — see list-filter-experience's "Narrow viewports filter
 * through an action bar and a bottom sheet".
 */
export function ResourceFilters({
  filters,
  onClear,
  count,
  title,
  columns,
  defaultOpen,
  className,
  sortSlot,
  fetchDraftTotal,
  hideMobileActionBar = false,
}: {
  filters: ResourceFilterDescriptor[]
  onClear?: () => void
  count?: ReactNode
  title?: string
  columns?: 1 | 2 | 3
  defaultOpen?: boolean
  className?: string
  /** Rendered in the mobile action bar next to "Filtros". */
  sortSlot?: ReactNode
  /** Leaves the bottom edge to another bar (a selection bar) on narrow
   *  viewports: the filter action bar is not rendered while it is set. */
  hideMobileActionBar?: boolean
  /** Only relevant when `filters` includes a `facet` descriptor: recomputes
   *  the match total for a draft combination of facet values while the
   *  mobile sheet is open, so its confirm button can read "Ver N resultados".
   *  Debounced 250ms; the previous total stays visible while a new one
   *  resolves. Omit for filter sets with no facet (or no counts to give). */
  fetchDraftTotal?: (
    draft: ResourceFilterDescriptor[]
  ) => number | Promise<number>
}) {
  const isMobile = useIsMobile()
  const activeCount = filters.filter(isFilterActive).length

  if (isMobile) {
    return (
      <MobileResourceFilters
        filters={filters}
        activeCount={activeCount}
        sortSlot={sortSlot}
        fetchDraftTotal={fetchDraftTotal}
        onClear={onClear}
        hideActionBar={hideMobileActionBar}
      />
    )
  }

  return (
    <CollapsibleFilters
      title={title}
      activeCount={activeCount}
      onClear={onClear}
      count={count}
      columns={columns}
      defaultOpen={defaultOpen}
      className={className}
    >
      {filters.map((filter) => (
        <FilterField
          key={filter.key}
          label={filter.label}
          htmlFor={filterHtmlFor(filter)}
        >
          {filter.kind === "facet" ? (
            <FacetFilterPopover filter={filter} />
          ) : (
            renderFilterControl(filter)
          )}
        </FilterField>
      ))}
    </CollapsibleFilters>
  )
}

/** The narrow-viewport half of `ResourceFilters`: an action bar that opens a
 *  sheet holding a local draft of the `facet` descriptors (other kinds apply
 *  live). Dismissing the sheet without confirming discards the draft — it is
 *  reseeded from the live values every time the sheet opens. */
function MobileResourceFilters({
  filters,
  activeCount,
  sortSlot,
  fetchDraftTotal,
  onClear,
  hideActionBar,
}: {
  filters: ResourceFilterDescriptor[]
  activeCount: number
  sortSlot?: ReactNode
  fetchDraftTotal?: (
    draft: ResourceFilterDescriptor[]
  ) => number | Promise<number>
  onClear?: () => void
  hideActionBar: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draftValues, setDraftValues] = useState<
    Record<string, ResourceFacetValue>
  >({})
  const [draftTotal, setDraftTotal] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    const seeded: Record<string, ResourceFacetValue> = {}
    for (const filter of filters) {
      if (filter.kind === "facet") seeded[filter.key] = filter.value
    }
    setDraftValues(seeded)
    // Reseed only on the open transition — `filters` is a fresh array every
    // render, and re-seeding on every keystroke would fight the user's edits.
  }, [open])

  const draftFilters = useMemo(
    () =>
      filters.map((filter) => {
        const draftValue = draftValues[filter.key]
        return filter.kind === "facet" && draftValue
          ? {
              ...filter,
              value: draftValue,
              onChange: (value: ResourceFacetValue) =>
                setDraftValues((prev) => ({ ...prev, [filter.key]: value })),
            }
          : filter
      }),
    [filters, draftValues]
  )

  useEffect(() => {
    if (!(open && fetchDraftTotal)) return
    const timeout = setTimeout(() => {
      Promise.resolve(fetchDraftTotal(draftFilters)).then(setDraftTotal)
    }, 250)
    return () => clearTimeout(timeout)
  }, [open, draftFilters, fetchDraftTotal])

  const apply = () => {
    for (const filter of draftFilters) {
      if (filter.kind !== "facet") continue
      const live = filters.find((f) => f.key === filter.key)
      if (live?.kind === "facet") live.onChange(filter.value)
    }
    setOpen(false)
  }

  const clear = onClear
    ? () => {
        onClear()
        setDraftValues({})
        setOpen(false)
      }
    : undefined

  return (
    <>
      {hideActionBar ? null : (
        <ListActionBar
          filterCount={activeCount}
          onOpenFilters={() => setOpen(true)}
          sortSlot={sortSlot}
        />
      )}
      <FilterSheet
        open={open}
        onOpenChange={setOpen}
        filters={draftFilters}
        resultCount={fetchDraftTotal ? draftTotal : undefined}
        onApply={apply}
        onClear={clear}
      />
    </>
  )
}
