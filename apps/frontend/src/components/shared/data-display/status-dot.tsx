import type { ReactNode } from "react"
import { Text } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import { cn } from "@/lib/utils"

/**
 * Visual emphasis for the small dot used to mark a row's state. Mirrors the
 * status palette DESIGN.md commits to: brand terracotta for "alive", ink
 * border for "paused", destructive for "failed", foreground for "ok" (never
 * green), and a muted grey for "skipped".
 */
export type StatusDotTone =
  | "primary"
  | "border"
  | "destructive"
  | "foreground"
  | "muted"

interface StatusDotProps {
  tone?: StatusDotTone
  /** When `true`, the dot pulses to indicate an in-flight action. */
  pulse?: boolean
  /** Adornment classes (e.g. `mt-1.5 shrink-0` to align with a row). */
  className?: string
}

const toneClass: Record<StatusDotTone, string> = {
  primary: "bg-primary",
  border: "bg-border",
  destructive: "bg-destructive",
  foreground: "bg-foreground",
  muted: "bg-muted-foreground/40",
}

/** The 1.5px status dot — used in list rows, sidebar items, and pills. */
export function StatusDot({
  tone = "primary",
  pulse = false,
  className,
}: StatusDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 rounded-full",
        toneClass[tone],
        pulse && "animate-pulse",
        className
      )}
    />
  )
}

interface StatusTagProps {
  /** Micro-caps text — "Activo", "Baneado", "Connected", "Hoy", etc. */
  children: ReactNode
  /**
   * Optional dot tone. When omitted, only the text is rendered (some sites
   * use the tag without a dot, e.g. a static state label).
   */
  dotTone?: StatusDotTone
  /** Pulse the dot. Useful for "running" states. */
  pulse?: boolean
  /** Optional hover hint (e.g. a ban reason), shown in a `Hint` bubble. */
  title?: string
  className?: string
}

/**
 * Micro-caps state label (the `status` role of `Text`), optionally paired
 * with a status dot.
 */
export function StatusTag({
  children,
  dotTone,
  pulse = false,
  title,
  className,
}: StatusTagProps) {
  const tag = (
    <Text
      variant="status"
      tone="muted"
      className={cn("flex items-center gap-1.5", className)}
    >
      {dotTone ? <StatusDot tone={dotTone} pulse={pulse} /> : null}
      {children}
    </Text>
  )

  return title ? <Hint label={title}>{tag}</Hint> : tag
}
