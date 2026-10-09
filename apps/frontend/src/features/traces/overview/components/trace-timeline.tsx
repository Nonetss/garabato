import { Text, textVariants } from "@/components/shared/brand/typography"
import { Badge } from "@/components/ui/badge"
import { TRAIL_TYPE_ICONS } from "@/features/traces/overview/definitions/trace-icons"
import {
  groupByRecency,
  TRAIL_TYPE_LABELS,
  traceDescription,
  traceSubject,
  traceTone,
} from "@/features/traces/overview/model/labels"
import type { TrailEntry } from "@/features/traces/overview/model/types"
import {
  formatDateTime,
  formatRelativeTime,
  joinFacts,
  NBSP,
} from "@/lib/format"
import { cn } from "@/lib/utils"

const bubbleTone = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
} as const

function metaLine(entry: TrailEntry) {
  const moment = formatDateTime(entry.occurredAt, {
    includeYear: true,
    includeSeconds: true,
  })
  if (entry.ipAddress === null) return moment
  return joinFacts([moment, `IP${NBSP}${entry.ipAddress}`])
}

function TimelineItem({
  entry,
  isLast,
  onOpen,
}: {
  entry: TrailEntry
  isLast: boolean
  onOpen: (entry: TrailEntry) => void
}) {
  const Icon = TRAIL_TYPE_ICONS[entry.type]
  const label = TRAIL_TYPE_LABELS[entry.type]
  const subject = traceSubject(entry)
  const description = traceDescription(entry)
  const relative = formatRelativeTime(entry.occurredAt)

  return (
    <li className="relative pb-2">
      {!isLast && (
        <span
          aria-hidden
          className="absolute top-11 bottom-0 left-[1.625rem] w-px bg-border"
        />
      )}
      <button
        type="button"
        onClick={() => onOpen(entry)}
        aria-label={`${label}: ${subject}, ${relative}`}
        className="flex w-full gap-4 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border",
            bubbleTone[traceTone(entry.type)]
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 flex-col gap-x-3 gap-y-1 @md:flex-row @md:items-start @md:justify-between">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <Text as="span" variant="title" className="min-w-0 truncate">
                {subject}
              </Text>
              <Badge variant="outline" className="text-muted-foreground">
                {label}
              </Badge>
            </span>
            <Text
              as="span"
              variant="compact"
              tone="muted"
              className="shrink-0 tabular-nums @md:pt-0.5"
            >
              {relative}
            </Text>
          </span>
          {description !== "" && (
            <Text
              as="span"
              variant="meta"
              tone="muted"
              className="wrap-break-word"
            >
              {description}
            </Text>
          )}
          <span className={textVariants({ role: "data", tone: "muted" })}>
            {metaLine(entry)}
          </span>
        </span>
      </button>
    </li>
  )
}

/** The trail as a vertical timeline grouped by recency ("Hoy", "Esta
 *  semana"…): one item per entry with its icon, subject, type, a sentence on
 *  what happened and when. An item opens the entry's detail. */
export function TraceTimeline({
  entries,
  onOpen,
}: {
  entries: TrailEntry[]
  onOpen: (entry: TrailEntry) => void
}) {
  return (
    <div className="@container flex flex-col gap-6">
      {groupByRecency(entries).map((group) => (
        <section key={group.label} className="flex flex-col gap-2">
          <Text as="h3" variant="meta" tone="muted" className="px-2.5">
            {group.label}
          </Text>
          <ol>
            {group.entries.map((entry, index) => (
              <TimelineItem
                key={entry.id}
                entry={entry}
                isLast={index === group.entries.length - 1}
                onOpen={onOpen}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
