import { useSyncExternalStore } from "react"

/**
 * The current pathname, kept in sync across Astro View Transitions.
 *
 * The navbar and other chrome are mounted with `transition:persist`, so their
 * islands survive client-side navigation and never re-run mount effects. A
 * pathname captured once on mount therefore goes stale the moment the user
 * navigates — this subscribes to `astro:page-load` instead.
 */
function subscribe(onChange: () => void) {
  document.addEventListener("astro:page-load", onChange)
  document.addEventListener("astro:after-swap", onChange)
  window.addEventListener("popstate", onChange)
  return () => {
    document.removeEventListener("astro:page-load", onChange)
    document.removeEventListener("astro:after-swap", onChange)
    window.removeEventListener("popstate", onChange)
  }
}

const getSnapshot = () => window.location.pathname
const getServerSnapshot = () => "/"

export function usePathname() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** True while the user is inside the `/admin` section. */
export function useIsAdminRoute() {
  return usePathname().startsWith("/admin")
}
