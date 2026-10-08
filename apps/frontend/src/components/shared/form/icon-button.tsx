import type { ComponentProps, ComponentType } from "react"
import { Hint, type HintProps } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export interface IconButtonProps
  extends Omit<ComponentProps<typeof Button>, "children" | "aria-label"> {
  /** Text of the `Hint` bubble, and the accessible name unless `accessibleLabel` is set. */
  label: string
  /**
   * A fuller accessible name when the bubble stays generic, e.g.
   * `Eliminar ${tag.name}` under an "Eliminar etiqueta" bubble.
   */
  accessibleLabel?: string
  icon: ComponentType<{ className?: string }>
  /** Classes for the glyph. The button sizes it otherwise (`size-4`, `size-3` on `icon-xs`). */
  iconClassName?: string
  /** Swaps the glyph for a spinner and marks the button busy. Disabling it stays with the caller. */
  pending?: boolean
  hintSide?: HintProps["side"]
}

function accessibleName(label: string, accessibleLabel: string | undefined) {
  if (accessibleLabel !== undefined) return accessibleLabel
  return label
}

/**
 * An icon-only action named by a `Hint` bubble: the `Hint` + `Button` +
 * `aria-label` composition every row action, toolbar control and inline
 * remove button repeats. Defaults to a ghost `icon-sm` `type="button"`.
 *
 * Not for menu, popover or dialog triggers, which wrap their own trigger in a
 * `Hint` (see `RowActionsMenu`).
 */
export function IconButton({
  label,
  accessibleLabel,
  icon: Icon,
  iconClassName,
  pending = false,
  hintSide,
  type = "button",
  variant = "ghost",
  size = "icon-sm",
  ...props
}: IconButtonProps) {
  const glyph = pending ? (
    <Spinner decorative className={iconClassName} />
  ) : (
    <Icon className={iconClassName} />
  )

  return (
    <Hint label={label} side={hintSide}>
      <Button
        type={type}
        variant={variant}
        size={size}
        aria-label={accessibleName(label, accessibleLabel)}
        aria-busy={pending}
        {...props}
      >
        {glyph}
      </Button>
    </Hint>
  )
}
