import { getIcon } from "@/lib/icon-registry"

const Clock = getIcon("navigation", "crons")

import type { RefObject } from "react"
import { Text } from "@/components/shared/brand/typography"
import { InfiniteScrollSentinel } from "@/components/shared/data-display/infinite-scroll-sentinel"
import { StateCard } from "@/components/shared/feedback/state-card"
import {
  SegmentedPicker,
  type SegmentedPickerOption,
} from "@/components/shared/form/segmented-picker"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { useCommentCounts } from "@/features/comments"
import {
  type CronRun,
  CronRunRow,
} from "@/features/crons/detail/components/cron-run-row"
import { formatDayHeader, formatDayLabel } from "@/lib/format"

export type CronRunFilter = "all" | "failed" | "skipped"

const filterOptions: readonly SegmentedPickerOption<CronRunFilter>[] = [
  { value: "all", label: "Todas" },
  { value: "failed", label: "Fallidas" },
  { value: "skipped", label: "Omitidas" },
]

const emptyTitle: Record<CronRunFilter, string> = {
  all: "Sin ejecuciones todavía",
  failed: "Sin ejecuciones fallidas",
  skipped: "Sin ejecuciones omitidas",
}

interface RunDay {
  key: string
  label: string
  runs: CronRun[]
}

/** Groups runs (newest first) under one entry per local calendar day. */
function groupByDay(runs: CronRun[]): RunDay[] {
  const days: RunDay[] = []
  for (const run of runs) {
    const key = new Date(run.startedAt).toDateString()
    const last = days.at(-1)
    if (last?.key === key) {
      last.runs.push(run)
    } else {
      days.push({
        key,
        label: formatDayHeader(formatDayLabel(run.startedAt)),
        runs: [run],
      })
    }
  }
  return days
}

/** The cron detail page's "Historial" section: heading + status filter, then
 *  the runs grouped by day with their infinite-scroll sentinel, or a loading
 *  or empty state. */
export function CronRunTimeline({
  runs,
  filter,
  onFilterChange,
  isPending,
  hasNextPage,
  isFetchingNextPage,
  sentinelRef,
}: {
  runs: CronRun[]
  filter: CronRunFilter
  onFilterChange: (filter: CronRunFilter) => void
  isPending: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  sentinelRef: RefObject<HTMLDivElement | null>
}) {
  // One batched count for every loaded run instead of one request per row.
  const { data: commentCounts } = useCommentCounts(
    runs.map((run) => ({ entityType: "cron-run", entityId: run.id }))
  )
  const commentCountByRunId = new Map(
    commentCounts?.map((row) => [row.entityId, row.count])
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <Text as="h2" variant="label" tone="muted">
            Historial
          </Text>
          {runs.length > 0 ? (
            <Text
              as="p"
              variant="compact"
              tone="muted"
              className="tabular-nums"
            >
              {runs.length}
              {hasNextPage ? "+" : ""}{" "}
              {runs.length === 1 ? "ejecución" : "ejecuciones"}
            </Text>
          ) : null}
        </div>
        <div className="w-full sm:w-64">
          <SegmentedPicker
            label="Filtrar ejecuciones por estado"
            options={filterOptions}
            value={filter}
            onChange={onFilterChange}
            columns={3}
          />
        </div>
      </div>

      {isPending ? (
        <StateCard spinner title="Cargando ejecuciones…" />
      ) : runs.length === 0 ? (
        <StateCard
          icon={<Clock className="size-6" />}
          title={emptyTitle[filter]}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groupByDay(runs).map((day) => (
            <div key={day.key} className="flex flex-col gap-2">
              <SectionHeading as="h3" title={day.label} />
              <ul className="divide-y rounded-xl border bg-card/40">
                {day.runs.map((run) => (
                  <CronRunRow
                    key={run.id}
                    run={run}
                    commentCount={commentCountByRunId.get(run.id) ?? 0}
                  />
                ))}
              </ul>
            </div>
          ))}
          <InfiniteScrollSentinel
            sentinelRef={sentinelRef}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
          />
        </div>
      )}
    </section>
  )
}
