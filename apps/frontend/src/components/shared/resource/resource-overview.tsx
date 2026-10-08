import type { ComponentProps, ReactNode } from "react"
import {
  QueryState,
  type QueryStateQuery,
} from "@/components/shared/feedback/query-state"
import { PageHero } from "@/components/shared/layout/page-hero"
import { PageShell } from "@/components/shared/layout/page-shell"
import type { SurfaceId } from "@/lib/app-surfaces"

interface StateCardDefinition {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export interface ResourceOverviewProps<TData> {
  surface: SurfaceId
  /** Overrides the surface's registered description. */
  description?: ReactNode
  heroMeta?: ReactNode
  heroStatus?: ReactNode
  heroAction?: ReactNode
  /** Full-width banner rendered under the hero's header row — `PageHero`'s `children` slot. */
  heroChildren?: ReactNode
  /** Rendered between the hero and the query-result region — typically `ResourceFilters`/`CollapsibleFilters`. */
  filters?: ReactNode
  query: QueryStateQuery<TData>
  loading: ReactNode
  error: {
    icon?: ReactNode
    title: ReactNode
    description?: ReactNode
    action?: ReactNode
  }
  isEmpty?: (data: TData) => boolean
  empty?: StateCardDefinition
  hasActiveFilters?: boolean
  filteredEmpty?: StateCardDefinition & {
    onClear?: () => void
    clearLabel?: string
  }
  fallback?: ReactNode
  /** The typed result renderer — an `EntityList` call or a feature-specific renderer. */
  children: (data: TData) => ReactNode
  /** Overrides the default `6xl` page width. */
  maxWidth?: ComponentProps<typeof PageShell>["maxWidth"]
  className?: string
}

/**
 * The repeated resource-page outer stack: `PageShell` + registry-driven
 * `PageHero` + optional filters + the query-result cascade. Composes
 * `PageShell`, `PageHero` and `QueryState` — it does not fetch data or own
 * mutations. A feature hook supplies the query-shaped model and callbacks;
 * this component only owns layout, spacing and the state cascade.
 *
 * Extension points are named slots (`heroMeta`, `heroStatus`, `heroAction`,
 * `filters`), not an unrestricted `children` region — `children` here is
 * specifically the query's success renderer, not a place to rebuild the
 * shell.
 */
export function ResourceOverview<TData>({
  surface,
  description,
  heroMeta,
  heroStatus,
  heroAction,
  heroChildren,
  filters,
  query,
  loading,
  error,
  isEmpty,
  empty,
  hasActiveFilters,
  filteredEmpty,
  fallback,
  children,
  maxWidth = "80%",
  className,
}: ResourceOverviewProps<TData>) {
  return (
    <PageShell maxWidth={maxWidth} className={className}>
      <div className="flex min-h-0 flex-1 flex-col gap-8">
        <PageHero
          surface={surface}
          description={description}
          meta={heroMeta}
          status={heroStatus}
          action={heroAction}
        >
          {heroChildren}
        </PageHero>
        {filters}
        <QueryState
          query={query}
          loading={loading}
          error={error}
          isEmpty={isEmpty}
          empty={empty}
          hasActiveFilters={hasActiveFilters}
          filteredEmpty={filteredEmpty}
          fallback={fallback}
        >
          {children}
        </QueryState>
      </div>
    </PageShell>
  )
}
