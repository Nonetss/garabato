import { useState } from "react"

export interface TargetDialog<T> {
  target: T | null
  /** Sets the target and (via `dialogProps.open`) opens the overlay. */
  open: (target: T) => void
  /** Clears the target and closes the overlay. */
  close: () => void
  /** Spread onto a controlled overlay (`Dialog`, `ConfirmDialog`, a sheet, ...): `open`/`onOpenChange`. */
  dialogProps: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }
}

/**
 * Local target-based overlay state: the repeated `useState<T | null>(null)` +
 * `open={!!target}` + `onOpenChange={(open) => !open && setTarget(null)}`
 * cascade behind row-level create/edit/detail/destructive-confirmation
 * overlays. Leaves the actual mutation to the caller — this only owns
 * "what row is this overlay currently about, and is it open."
 */
export function useTargetDialog<T>(): TargetDialog<T> {
  const [target, setTarget] = useState<T | null>(null)

  return {
    target,
    open: setTarget,
    close: () => setTarget(null),
    dialogProps: {
      open: target !== null,
      onOpenChange: (open) => {
        if (!open) setTarget(null)
      },
    },
  }
}
