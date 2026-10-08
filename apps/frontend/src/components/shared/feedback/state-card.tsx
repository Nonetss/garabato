import { getIcon } from "@/lib/icon-registry"

const Loader2 = getIcon("status", "loading")

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Shared full-width state: loading spinners, empty states, errors and
 * success screens, with the dashboard's entrance motion.
 */
export function StateCard({
  icon,
  spinner = false,
  title,
  description,
  action,
  tone = "muted",
  className,
}: {
  icon?: ReactNode
  spinner?: boolean
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  tone?: "muted" | "destructive" | "celebrate"
  className?: string
}) {
  return (
    <div
      className={cn(
        "dash-enter relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-dashed bg-card/40 px-6 py-16 text-center",
        tone === "celebrate" && "border-solid",
        className
      )}
    >
      {spinner ? (
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      ) : icon ? (
        <div
          className={cn(
            "dash-pop flex size-10 items-center justify-center text-muted-foreground",
            tone === "destructive" && "text-destructive",
            tone === "celebrate" && "text-primary"
          )}
        >
          {icon}
        </div>
      ) : null}

      <div className="relative">
        <p
          className={cn(
            "font-medium tracking-tight",
            tone === "celebrate" ? "text-lg" : "text-base",
            tone === "destructive" && "text-destructive"
          )}
        >
          {title}
        </p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="relative mt-1">{action}</div> : null}
    </div>
  )
}
