import type { ReactNode } from "react"
import { StateCard } from "@/components/shared/feedback/state-card"
import { Button } from "@/components/ui/button"
import { getIcon } from "@/lib/icon-registry"

const FilterX = getIcon("views", "clearFilters")

export type QueryStateQuery<TData> = {
  data: TData | undefined
  isPending: boolean
  isError: boolean
  refetch: () => unknown
}

interface StateCardDefinition {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

/**
 * Shared error → pending → empty → filtered-empty → success cascade over
 * `StateCard`, replacing the hand-written cascade repeated across list/detail
 * pages.
 *
 * `isEmpty`/`empty` describe the *source* being empty (no filter involved).
 * `hasActiveFilters`/`filteredEmpty` describe the case where source data
 * exists but the active filters hide all of it — pass `hasActiveFilters` from
 * the feature's filter state (e.g. `activeFilterCount > 0`) and `data` should
 * already be the filtered view. When filters are active and the filtered view
 * is empty, `filteredEmpty` renders instead of `empty`; when omitted, a
 * default filtered-empty copy with a "Limpiar filtros" action (only shown if
 * `onClear` is given) is used.
 */
export function QueryState<TData>({
  query,
  loading,
  error,
  isEmpty,
  empty,
  hasActiveFilters = false,
  filteredEmpty,
  fallback,
  children,
}: {
  query: QueryStateQuery<TData>
  /** Spinner `StateCard` title while the query is pending. */
  loading: ReactNode
  error: {
    icon?: ReactNode
    title: ReactNode
    description?: ReactNode
    /** Override the default outline "Reintentar" action. */
    action?: ReactNode
  }
  isEmpty?: (data: TData) => boolean
  empty?: StateCardDefinition
  /** True when a filter is currently narrowing `data`. */
  hasActiveFilters?: boolean
  filteredEmpty?: StateCardDefinition & {
    /** Clears the active filters. Renders the default "Limpiar filtros" action when `action` isn't set. */
    onClear?: () => void
    clearLabel?: string
  }
  /** Replace the default pending `StateCard` with a custom node (e.g. skeletons). */
  fallback?: ReactNode
  children: (data: TData) => ReactNode
}) {
  if (query.isError) {
    return (
      <StateCard
        icon={error.icon}
        title={error.title}
        description={error.description}
        tone="destructive"
        action={
          error.action ?? (
            <Button variant="outline" onClick={() => query.refetch()}>
              Reintentar
            </Button>
          )
        }
      />
    )
  }

  if (query.isPending) {
    return fallback ?? <StateCard spinner title={loading} />
  }

  const data = query.data as TData
  const dataIsEmpty = isEmpty?.(data) ?? false

  if (dataIsEmpty && hasActiveFilters) {
    const definition = filteredEmpty ?? {
      title: "Sin resultados",
      description: "Ningún elemento coincide con los filtros aplicados.",
    }
    return (
      <StateCard
        icon={definition.icon}
        title={definition.title}
        description={definition.description}
        action={
          definition.action ??
          (definition.onClear ? (
            <Button variant="outline" onClick={definition.onClear}>
              <FilterX className="size-4" />
              {definition.clearLabel ?? "Limpiar filtros"}
            </Button>
          ) : undefined)
        }
      />
    )
  }

  if (dataIsEmpty && empty) {
    return (
      <StateCard
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={empty.action}
      />
    )
  }

  return <>{children(data)}</>
}
