import { useState } from "react"

export interface EditDialog<T> {
  /** The row being edited, or `null` when the dialog is in create mode (or closed). */
  editing: T | null
  isEditing: boolean
  openCreate: () => void
  openEdit: (target: T) => void
  /** Spread onto a controlled `FormDialog`: `open`/`onOpenChange`. */
  dialogProps: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }
}

/**
 * Local state for a dialog shared between "create" and "edit" — unlike
 * `useTargetDialog`, `null` doesn't mean closed here (create mode has no
 * target but is open), so open/closed and the target are tracked separately.
 * Same small vocabulary as `useTargetDialog` (a typed target + controlled
 * open bindings), kept as its own hook rather than overloading the
 * target-means-open semantics that make `useTargetDialog` correct for
 * destructive confirmations and other target-only overlays.
 */
export function useEditDialog<T>(): EditDialog<T> {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)

  return {
    editing,
    isEditing: editing !== null,
    openCreate: () => {
      setEditing(null)
      setOpen(true)
    },
    openEdit: (target) => {
      setEditing(target)
      setOpen(true)
    },
    dialogProps: {
      open,
      onOpenChange: setOpen,
    },
  }
}
