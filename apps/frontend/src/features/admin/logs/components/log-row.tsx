import { getIcon } from "@/lib/icon-registry"

const ChevronDown = getIcon("controls", "expand")

import type { CSSProperties } from "react"
import { useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { JsonView } from "@/components/shared/data-display/json-view"
import { StatusDot } from "@/components/shared/data-display/status-dot"
import type { ActivityLogEntry } from "@/features/admin/logs/model/types"
import { useAdminUser } from "@/hooks/use-admin-user"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const typeLabel: Record<string, string> = {
  page_view: "Frontend",
  api_call: "Backend",
}

const ENTER_CAP = 12

function LogRowUser({ userId }: { userId: string | null }) {
  const { data: user } = useAdminUser(userId)
  if (!userId) {
    return <span className="text-muted-foreground italic">Anónimo</span>
  }
  return <span className="truncate">{user?.email ?? user?.name ?? userId}</span>
}

/** One row of the activity log: a summary line that expands into the raw
 *  JSON payload (and, on small screens, the user/date pair it hides). */
export function LogRow({
  entry,
  index,
}: {
  entry: ActivityLogEntry
  index: number
}) {
  const [open, setOpen] = useState(false)
  const isError = entry.level === "error" || entry.level === "fatal"
  const path = entry.path ?? entry.message

  return (
    <article
      className="dash-enter"
      style={
        {
          "--dash-delay": `${Math.min(index, ENTER_CAP) * 40}ms`,
        } as CSSProperties
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
      >
        <StatusDot
          tone={isError ? "destructive" : "foreground"}
          className="shrink-0"
        />

        <Text
          variant="compact"
          tone="muted"
          className="hidden w-36 shrink-0 truncate sm:block"
        >
          <LogRowUser userId={entry.userId} />
        </Text>

        <Text variant="data" className="min-w-0 flex-1 truncate">
          {entry.method ? (
            <span className="text-muted-foreground">{entry.method} </span>
          ) : null}
          {path}
        </Text>

        <Text
          variant="status"
          tone="muted"
          className="hidden w-16 shrink-0 truncate md:block"
        >
          {typeLabel[entry.type] ?? entry.type}
        </Text>

        <span
          className={cn(
            textVariants({ role: "data" }),
            "w-8 shrink-0 text-right",
            isError ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {entry.statusCode ?? "—"}
        </span>

        <Text
          variant="data"
          tone="muted"
          className="hidden shrink-0 whitespace-nowrap sm:block"
        >
          {formatDateTime(entry.timestamp, { includeSeconds: true })}
        </Text>

        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div className="border-t px-4 py-3 sm:px-5">
          <dl
            className={cn(
              textVariants({ role: "compact" }),
              "mb-3 grid grid-cols-2 gap-x-5 gap-y-2 sm:hidden"
            )}
          >
            <div>
              <dt className="text-muted-foreground">Usuario</dt>
              <dd className="mt-0.5 truncate">
                <LogRowUser userId={entry.userId} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="mt-0.5 font-mono tabular-nums">
                {formatDateTime(entry.timestamp, { includeSeconds: true })}
              </dd>
            </div>
          </dl>
          <JsonView
            value={entry.raw}
            className="overflow-x-auto rounded-md border-0 bg-muted/40"
          />
        </div>
      ) : null}
    </article>
  )
}
