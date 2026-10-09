import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import { TRAIL_TYPE_ICONS } from "@/features/traces/overview/definitions/trace-icons"
import {
  TRAIL_TYPE_LABELS,
  traceSubject,
  traceSummary,
} from "@/features/traces/overview/model/labels"
import type { TrailEntry } from "@/features/traces/overview/model/types"
import { formatDateTime } from "@/lib/format"

export interface TracesRowContext {
  onOpen: (entry: TrailEntry) => void
}

function TypeLabel({ entry }: { entry: TrailEntry }) {
  const Icon = TRAIL_TYPE_ICONS[entry.type]
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {TRAIL_TYPE_LABELS[entry.type]}
    </span>
  )
}

/** The trail's `EntityList` row: what happened, to which document or
 *  certificate, when, and a one-line summary of the change. The row opens
 *  the entry's detail. */
export const traceDefinition: EntityListDefinition<
  TrailEntry,
  TracesRowContext
> = {
  getKey: (entry) => entry.id,
  getAccessibleLabel: (entry) =>
    `${TRAIL_TYPE_LABELS[entry.type]}: ${traceSubject(entry)}, ${formatDateTime(
      entry.occurredAt,
      { includeYear: true }
    )}`,
  getPrimary: (entry) => <TypeLabel entry={entry} />,
  getSecondary: traceSubject,
  onOpen: (entry, context) => context.onOpen(entry),
  metadata: [
    {
      key: "occurredAt",
      label: "Fecha",
      value: (entry) => (
        <span className="tabular-nums">
          {formatDateTime(entry.occurredAt, { includeYear: true })}
        </span>
      ),
    },
    {
      key: "summary",
      label: "Detalle",
      value: (entry) => traceSummary(entry),
      hidden: (entry) => traceSummary(entry) === "",
    },
  ],
}
