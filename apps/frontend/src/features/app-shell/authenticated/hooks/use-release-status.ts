import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

// The backend looks GitHub up at most every few hours; an hour here keeps
// page navigations from asking again.
const RELEASE_STALE_MS = 60 * 60 * 1000

/** The running version and, for administrators, a newer release; only
 *  asked for once someone is signed in. */
export function useReleaseStatus(enabled: boolean) {
  return useHydratedQuery(
    orpc.v1.release.status.queryOptions({
      staleTime: RELEASE_STALE_MS,
      enabled,
    })
  )
}
