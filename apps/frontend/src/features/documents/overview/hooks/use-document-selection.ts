import { useEffect, useState } from "react"

/**
 * The documents selected on the page. Only ids still listed count, so a
 * document that leaves the view (deleted, moved away) drops out on its own.
 * The selection is cleared whenever `resetKey` changes (another folder or
 * other filters) and when Escape is pressed.
 */
export function useDocumentSelection(visibleIds: string[], resetKey: string) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  // `resetKey` is only the trigger: another folder or other filters.
  useEffect(() => {
    setSelected(new Set())
  }, [resetKey])

  const ids = visibleIds.filter((id) => selected.has(id))
  const count = ids.length

  useEffect(() => {
    if (count === 0) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(new Set())
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [count])

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const allSelected = visibleIds.length > 0 && count === visibleIds.length

  return {
    ids,
    count,
    allSelected,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAll: () => {
      if (allSelected) {
        setSelected(new Set())
        return
      }
      setSelected(new Set(visibleIds))
    },
    clear: () => setSelected(new Set()),
  }
}
