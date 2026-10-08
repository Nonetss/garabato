import { Text } from "@/components/shared/brand/typography"
import { MetadataCell } from "@/components/shared/data-display/metadata-cell"
import { Hint } from "@/components/shared/feedback/hint"
import {
  buildRunPulse,
  type PulseBar,
  type PulseRun,
} from "@/features/crons/detail/model/run-pulse"
import type { CronRunStatus } from "@/features/crons/shared"
import { cronRunStatusLabels } from "@/features/crons/shared"
import { formatDateTime, formatDurationMs } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Bars drawn below `md`, so each mark stays legible at phone width. */
const MOBILE_BAR_COUNT = 24

const barTone: Record<CronRunStatus, string> = {
  success: "bg-foreground/30",
  failed: "bg-destructive",
  skipped: "bg-muted-foreground/45",
  running: "bg-primary",
}

const legend: { status: CronRunStatus; swatch: string }[] = [
  { status: "success", swatch: "size-2" },
  { status: "failed", swatch: "size-2" },
  { status: "skipped", swatch: "h-0.5 w-2" },
]

const percentFormat = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 1,
})

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

function PulseBarMark({
  bar,
  hideOnMobile,
}: {
  bar: PulseBar
  hideOnMobile: boolean
}) {
  const duration =
    bar.durationMs === null ? null : formatDurationMs(bar.durationMs)
  return (
    <Hint
      label={[
        cronRunStatusLabels[bar.status],
        formatDateTime(bar.startedAt, { includeSeconds: true }),
        duration,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <span
        className={cn(
          "block min-w-0 flex-1 rounded-[1px]",
          barTone[bar.status],
          hideOnMobile && "max-md:hidden"
        )}
        style={{ height: `${bar.heightPct}%` }}
      />
    </Hint>
  )
}

/** The cron detail page's "Pulso" section: one bar per recent run (height =
 *  duration, tone = status) plus success rate, streak and p50/p95. */
export function CronRunPulse({ runs }: { runs: PulseRun[] }) {
  const { bars, stats } = buildRunPulse(runs)
  const { counts } = stats
  const oldest = bars[0]
  const oldestOnMobile = bars[Math.max(0, bars.length - MOBILE_BAR_COUNT)]
  const newest = bars.at(-1)
  const summary = [
    plural(stats.total, "ejecución", "ejecuciones"),
    plural(counts.success, "correcta", "correctas"),
    plural(counts.failed, "fallida", "fallidas"),
    plural(counts.skipped, "omitida", "omitidas"),
    counts.running > 0 ? `${counts.running} en curso` : null,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-3">
          <Text as="h2" variant="label" tone="muted">
            Pulso
          </Text>
          <Text as="p" variant="compact" tone="muted" className="tabular-nums">
            Últimas {plural(stats.total, "ejecución", "ejecuciones")}
          </Text>
        </div>
        <ul className="flex items-center gap-4">
          {legend.map(({ status, swatch }) => (
            <Text
              key={status}
              as="li"
              variant="label"
              tone="muted"
              className="flex items-center gap-1.5"
            >
              <span
                aria-hidden
                className={cn("rounded-[1px]", swatch, barTone[status])}
              />
              {cronRunStatusLabels[status]}
            </Text>
          ))}
        </ul>
      </div>

      <div className="flex flex-col rounded-xl border bg-card/40 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
          <div
            role="img"
            aria-label={summary}
            className="flex h-14 items-end gap-[3px]"
          >
            {bars.map((bar, index) => (
              <PulseBarMark
                key={bar.id}
                bar={bar}
                hideOnMobile={index < bars.length - MOBILE_BAR_COUNT}
              />
            ))}
          </div>
          <div className="flex justify-between">
            <Text variant="data" tone="muted" className="max-md:hidden">
              {formatDateTime(oldest?.startedAt ?? null)}
            </Text>
            <Text variant="data" tone="muted" className="md:hidden">
              {formatDateTime(oldestOnMobile?.startedAt ?? null)}
            </Text>
            <Text variant="data" tone="muted">
              {formatDateTime(newest?.startedAt ?? null)}
            </Text>
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t md:w-80 md:shrink-0 md:border-t-0 md:border-l">
          <MetadataCell as="dl" label="Tasa de éxito" className="border-b p-4">
            <Text variant="stat">
              {stats.successRate === null
                ? "—"
                : percentFormat.format(stats.successRate)}
            </Text>
          </MetadataCell>
          <MetadataCell
            as="dl"
            label="Racha actual"
            className="border-b border-l p-4"
          >
            <span className="flex items-baseline gap-1.5">
              <Text variant="stat">{stats.streak}</Text>
              <Text variant="compact" tone="muted">
                {stats.streak === 1 ? "correcta" : "correctas"}
              </Text>
            </span>
          </MetadataCell>
          <MetadataCell as="dl" label="Duración p50" className="p-4">
            <Text variant="data">
              {stats.p50Ms === null ? "—" : formatDurationMs(stats.p50Ms)}
            </Text>
          </MetadataCell>
          <MetadataCell as="dl" label="Duración p95" className="border-l p-4">
            <Text variant="data">
              {stats.p95Ms === null ? "—" : formatDurationMs(stats.p95Ms)}
            </Text>
          </MetadataCell>
        </dl>
      </div>
    </section>
  )
}
