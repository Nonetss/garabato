import { useState } from "react"

/**
 * Runs `seed` exactly on the `false -> true` transition of `open`.
 *
 * Form dialogs need to load their fields from an `initial` prop when they open.
 * Doing that in an effect keyed on `[open, initial]` misfires, because callers
 * build `initial` inline (`initial={{ name: device.name }}`) — a fresh object
 * on every parent render, and these pages re-render whenever a query refetches.
 * The result is a dialog that silently discards what the user has typed.
 *
 * This adjusts state during render instead of after commit, so the reseeded
 * values are painted in the same pass rather than flashing the previous ones.
 * `seed` may call the component's own `setState` functions freely.
 */
export function useOnOpen(open: boolean, seed: () => void) {
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) seed()
  }
}
