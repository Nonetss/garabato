import { useEffect, useState } from "react"

/**
 * Trails `value` by `delay` ms, resetting the timer on every change.
 *
 * Use for search boxes: keep the input itself controlled and instant, and feed
 * the debounced copy to the query key so typing doesn't fire a request per
 * keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    if (Object.is(value, debounced)) return
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay, debounced])

  return debounced
}
