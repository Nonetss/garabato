/**
 * `items` with the one at `from` moved to `to`, both clamped to the list.
 * Returns the same array when nothing moves.
 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const last = items.length - 1
  const source = Math.min(Math.max(from, 0), last)
  const target = Math.min(Math.max(to, 0), last)
  if (source === target || items.length === 0) return items
  const next = [...items]
  const [moved] = next.splice(source, 1)
  if (moved === undefined) return items
  next.splice(target, 0, moved)
  return next
}
