import type { ReactNode, Ref } from "react"
import { cn } from "@/lib/utils"

interface ScrollPanelProps {
  children: ReactNode
  /** Receives the scrolling element, e.g. as `useInfiniteScroll`'s root. */
  scrollRef?: Ref<HTMLDivElement>
  /** Hairlines between the panel's direct children (rows rendered straight into it). */
  divided?: boolean
  /** Pinned below the scrolling area behind a hairline: pagination, a range count. */
  footer?: ReactNode
}

/**
 * A soft card (`rounded-xl border bg-card/40`) that fills the rest of a
 * flex-column page and scrolls inside itself, so long admin lists keep the
 * hero and filters in view. Used inside `ResourceOverview`'s success
 * renderer.
 */
export function ScrollPanel({
  children,
  scrollRef,
  divided = false,
  footer,
}: ScrollPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card/40">
      <div
        ref={scrollRef}
        className={cn("min-h-0 flex-1 overflow-y-auto", divided && "divide-y")}
      >
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t px-4 py-3">{footer}</div>
      ) : null}
    </div>
  )
}
