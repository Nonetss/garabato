import { useSyncExternalStore } from "react"

const QUERY = "(pointer: fine)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches
// Server render can't know the pointer; touch is the safer guess.
const getServerSnapshot = () => false

/**
 * `true` when the primary pointer is precise (mouse, trackpad), `false` on
 * touch. Gates interactions a finger can't do well, like native drag and
 * drop or drawing a rectangle, and the copy that names them ("arrastra",
 * "suelta"). Read during render, like `useIsMobile`, so the first client
 * paint is already right.
 */
export function useFinePointer() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
