import type { ReactNode } from "react"
import type { ConfirmDialogProps } from "@/components/ui/confirm-dialog"
import { type TargetDialog, useTargetDialog } from "@/hooks/use-target-dialog"

export interface UseTargetConfirmDialogOptions<T> {
  title: string
  /** Copy derived from the target — e.g. the entity's name, a row count. */
  description: (target: T) => ReactNode
  confirmLabel: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  /** The mutation. Its input comes entirely from `target` — no second identifier lookup. */
  onConfirm: (target: T) => Promise<unknown> | unknown
}

/**
 * Target-confirmation adapter over `useTargetDialog`: derives `ConfirmDialog`
 * props (copy, controlled open state, the confirm handler) from a typed
 * target, so a row-level destructive action is `open(target)` +
 * `<ConfirmDialog {...confirmDialogProps} />` instead of a hand-built
 * `useState`/ternary-description/null-guard cascade. The mutation itself
 * stays feature-owned — this only wires the target through to it.
 */
export function useTargetConfirmDialog<T>({
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "destructive",
  onConfirm,
}: UseTargetConfirmDialogOptions<T>): TargetDialog<T> & {
  confirmDialogProps: ConfirmDialogProps
} {
  const dialog = useTargetDialog<T>()

  const confirmDialogProps: ConfirmDialogProps = {
    ...dialog.dialogProps,
    title,
    description: dialog.target ? description(dialog.target) : undefined,
    confirmLabel,
    cancelLabel,
    variant,
    onConfirm: async () => {
      if (!dialog.target) return true
      await onConfirm(dialog.target)
      return true
    },
  }

  return { ...dialog, confirmDialogProps }
}
