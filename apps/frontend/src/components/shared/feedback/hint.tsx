import type { ReactElement, ReactNode } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface HintProps {
  /** Text shown in the bubble; usually the control's `aria-label`. */
  label: ReactNode
  /**
   * The control the bubble points at. Rendered as the tooltip trigger, so it
   * must accept props and a ref (`Button`, `NavbarAction`, a menu trigger…).
   */
  children: ReactElement
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

/**
 * Hover/focus bubble that names an icon-only control, in place of the
 * browser's native `title` tooltip. Keep the control's own `aria-label`: the
 * bubble is a visual hint, not its accessible name. Touch devices never show
 * it, so the icon must still be understandable without it.
 */
export function Hint({ label, children, side = "top", align }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger delay={300} render={children} />
      <TooltipContent side={side} align={align}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
