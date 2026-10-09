import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const MAX_WIDTH = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  /** Full width on mobile and tablet; capped at 80% from `lg`. */
  "80%": "lg:max-w-[80%]",
  /** Fill the sidebar inset — tables and canvases on desktop. */
  full: "max-w-none",
} as const

const PADDING = {
  page: "px-4 py-6 sm:px-6",
  compact: "px-3 py-3 sm:px-6 sm:py-6",
} as const

/**
 * Standard page frame: a padded `<main>` plus a centred max-width container.
 * `full` drops the cap so tables and canvases fill the sidebar inset on
 * desktop; lists stay at `6xl`. Runtime providers belong at the React-island
 * or feature-page boundary so this visual layout remains context-agnostic.
 */
export function PageShell({
  maxWidth = "80%",
  padding = "page",
  className,
  children,
}: {
  maxWidth?: keyof typeof MAX_WIDTH
  padding?: keyof typeof PADDING
  className?: string
  children: ReactNode
}) {
  return (
    <main className={cn("flex min-h-0 flex-1 flex-col", PADDING[padding])}>
      <div
        className={cn(
          "mx-auto flex w-full min-h-0 flex-1 flex-col",
          MAX_WIDTH[maxWidth],
          className
        )}
      >
        {children}
      </div>
    </main>
  )
}
