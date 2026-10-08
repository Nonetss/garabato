import { cn } from "@/lib/utils"

/** How the rubric appears: already written, written once, or rewritten in a
 *  loop while something is in flight. */
export type RubricMotion = "static" | "write" | "loop"

export interface RubricProps {
  motion?: RubricMotion
  /** Accessible name; when omitted the mark is decorative (`aria-hidden`). */
  label?: string
  className?: string
}

// The same single stroke and baseline as `assets/logo.svg`.
const SIGNATURE_PATH =
  "M3 15c3 0 6.5-1.5 8.5-5s1.5-6.5-.5-6.5S7.5 8 8.5 12s2.5 4.5 4 4.5 2-2.5 3.5-2.5 1.5 2 3 2 1.5-.5 2-1"
const BASELINE_PATH = "M3 21h18"

const signatureMotion: Record<RubricMotion, string | undefined> = {
  static: undefined,
  write: "rubric-write",
  loop: "rubric-loop",
}

// The baseline is ruled once the stroke has landed; a looping rubric keeps
// its baseline still so the line it writes on never flickers.
const baselineMotion: Record<RubricMotion, string | undefined> = {
  static: undefined,
  write: "rubric-write [--rubric-delay:0.9s] [--rubric-duration:0.5s]",
  loop: undefined,
}

/**
 * Garabato's rubric drawn as live SVG: the terracotta signature over an ink
 * baseline, like a signed line on a form. `write` draws the stroke once and
 * then rules the baseline; `loop` keeps writing for in-flight work. Reduced
 * motion always shows the finished mark.
 */
export function Rubric({ motion = "static", label, className }: RubricProps) {
  const labelled = label !== undefined

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={label}
      data-motion={motion}
      className={cn("shrink-0", className)}
    >
      <path
        d={SIGNATURE_PATH}
        pathLength={1}
        strokeWidth={1.75}
        className={cn("stroke-brand", signatureMotion[motion])}
      />
      <path
        d={BASELINE_PATH}
        pathLength={1}
        strokeWidth={0.75}
        className={cn("stroke-foreground/25", baselineMotion[motion])}
      />
    </svg>
  )
}
