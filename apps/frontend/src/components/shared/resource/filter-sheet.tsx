import {
  type ResourceFilterDescriptor,
  ResourceFilterFields,
} from "@/components/shared/resource/resource-filters"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

function confirmLabel(resultCount: number | undefined) {
  if (resultCount === undefined) return "Cargando…"
  if (resultCount === 0) return "Sin resultados"
  return `Ver ${resultCount} resultado${resultCount === 1 ? "" : "s"}`
}

/**
 * Bottom sheet edited by `ListActionBar`'s "Filtros" control: renders one
 * field per descriptor and a sticky confirm button reading how many results
 * the current combination produces — see list-filter-experience's "Narrow
 * viewports filter through an action bar and a bottom sheet". Whether an
 * edit applies immediately or waits for the confirm button is the caller's
 * choice, expressed through which descriptors it passes as drafted (see
 * `ResourceFilters`' `MobileResourceFilters`): this component only renders
 * the sheet chrome and always calls `onApply` when the confirm button is
 * pressed.
 */
export function FilterSheet({
  open,
  onOpenChange,
  title = "Filtros",
  filters,
  resultCount,
  onApply,
  onClear,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  filters: ResourceFilterDescriptor[]
  /** `undefined` while the count for the current draft is still loading. */
  resultCount: number | undefined
  onApply: () => void
  /** Clears every filter (drafted and live) and closes the sheet. Omitted
   *  when the caller has nothing to clear. */
  onClear?: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[85dvh] flex-col gap-0 rounded-t-xl p-0"
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b pb-3">
          <SheetTitle>{title}</SheetTitle>
          {onClear ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mr-3"
              onClick={onClear}
            >
              Limpiar
            </Button>
          ) : null}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <ResourceFilterFields filters={filters} />
        </div>
        <SheetFooter className="border-t bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            type="button"
            className="h-11 w-full"
            onClick={() => {
              onApply()
              onOpenChange(false)
            }}
          >
            {confirmLabel(resultCount)}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
