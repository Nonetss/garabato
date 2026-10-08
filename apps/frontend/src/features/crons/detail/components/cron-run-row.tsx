import { getIcon } from "@/lib/icon-registry"

const ChevronDown = getIcon("controls", "expand")

import { useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { JsonView } from "@/components/shared/data-display/json-view"
import {
  StatusDot,
  type StatusDotTone,
} from "@/components/shared/data-display/status-dot"
import { CopyButton } from "@/components/shared/form/copy-button"
import { Button } from "@/components/ui/button"
import { CommentsButton } from "@/features/comments"
import type { CronRunStatus, useCronRuns } from "@/features/crons/shared"
import { cronRunStatusLabels } from "@/features/crons/shared"
import { formatDateTime, formatDuration, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export type CronRun = NonNullable<
  ReturnType<typeof useCronRuns>["data"]
>["pages"][number]["runs"][number]

const statusDotTone: Record<CronRunStatus, StatusDotTone> = {
  success: "foreground",
  failed: "destructive",
  running: "primary",
  skipped: "muted",
}

function stringifyForCopy(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/** One line of the run history: status, start time, duration, comments and
 *  an expandable error/result disclosure when the run carries one. The comment
 *  count comes from the timeline's batched query, so rows never fetch it. */
export function CronRunRow({
  run,
  commentCount,
}: {
  run: CronRun
  commentCount: number
}) {
  const [expanded, setExpanded] = useState(false)
  const errorText = run.errorMessage ?? null
  const hasResult = run.result !== null && run.result !== undefined
  const showDisclosure = errorText !== null || hasResult
  const panelId = `cron-run-output-${run.id}`
  const copyText = errorText ?? (hasResult ? stringifyForCopy(run.result) : "")
  const startedAt = formatDateTime(run.startedAt, {
    includeSeconds: true,
    includeYear: true,
  })

  return (
    <li className="px-4">
      <div className="flex min-h-12 items-center gap-3.5">
        <StatusDot
          tone={statusDotTone[run.status]}
          pulse={run.status === "running"}
          className="size-2 shrink-0"
        />
        <Text variant="title" className="w-20 shrink-0">
          {cronRunStatusLabels[run.status]}
        </Text>
        <Text variant="data" tone="muted">
          {formatTime(run.startedAt, { includeSeconds: true })}
        </Text>
        <span className="flex-1" />
        <Text variant="data">
          {run.finishedAt
            ? formatDuration(run.startedAt, run.finishedAt)
            : "en curso"}
        </Text>
        <CommentsButton
          compact
          entity={{ entityType: "cron-run", entityId: run.id }}
          count={commentCount}
          title={`Comentarios · ${cronRunStatusLabels[run.status]}`}
          description={`Ejecución iniciada el ${startedAt}`}
          label={`Comentarios de la ejecución del ${startedAt}`}
        />
        {showDisclosure ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              textVariants({ role: "compact", tone: "muted" }),
              "h-7 gap-1.5 px-2"
            )}
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            <span className="max-sm:sr-only">
              {errorText ? "Ver error" : "Ver resultado"}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </Button>
        ) : (
          <span aria-hidden className="w-7 shrink-0 sm:w-[6.5rem]" />
        )}
      </div>

      {showDisclosure && expanded ? (
        <div className="pb-4 pl-[1.375rem]">
          <div className="flex justify-end">
            <CopyButton
              text={copyText}
              label={errorText ? "Copiar error" : "Copiar resultado"}
            />
          </div>
          {errorText ? (
            <pre
              id={panelId}
              className={cn(
                textVariants({ role: "data", tone: "destructive" }),
                "mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-destructive/20 bg-destructive/5 p-3 leading-relaxed"
              )}
            >
              {errorText}
            </pre>
          ) : (
            <JsonView
              id={panelId}
              value={run.result}
              className="mt-2 max-h-64"
            />
          )}
        </div>
      ) : null}
    </li>
  )
}
