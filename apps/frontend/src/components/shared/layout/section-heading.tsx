import type { ReactNode } from "react"
import { Text } from "@/components/shared/brand/typography"
import { cn } from "@/lib/utils"

export interface SectionHeadingProps {
  /** Section name, set as a micro-caps label. */
  title: ReactNode
  /** Item count shown after the title as `(n)` in sentence-case tabular text. */
  count?: number
  /** Trailing control aligned to the right, typically one small `Button`. */
  action?: ReactNode
  /** Heading level; `h2` for page sections, `h3` inside an already-headed block. */
  as?: "h2" | "h3"
  className?: string
}

/**
 * Micro-caps heading for a section inside a page, sheet or dialog: the
 * section name, an optional `(n)` count and an optional right-aligned action.
 * The typographic counterpart to `PageHero` one level down — no border, no
 * icon, no badge.
 */
export function SectionHeading({
  title,
  count,
  action,
  as = "h2",
  className,
}: SectionHeadingProps) {
  const heading = (
    <Text as={as} variant="label" tone="muted">
      {title}
      {count === undefined ? null : (
        <>
          {" "}
          <span className="font-normal normal-case tracking-normal tabular-nums">
            ({count})
          </span>
        </>
      )}
    </Text>
  )

  if (!action) {
    return className ? <div className={className}>{heading}</div> : heading
  }

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {heading}
      {action}
    </div>
  )
}
