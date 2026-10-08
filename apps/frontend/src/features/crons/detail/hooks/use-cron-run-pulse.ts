import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

/** How many of the latest runs the pulse strip summarises. */
export const CRON_RUN_PULSE_WINDOW = 48

/**
 * Latest runs of a job, unfiltered, for the pulse strip. Kept apart from the
 * history list because that one is filtered by status and paged by scroll.
 * It doesn't poll: `useCronRunEvents` refetches it when a run changes.
 */
export const useCronRunPulse = (jobId: string | null) =>
  useHydratedQuery({
    ...orpc.v1.cron.listRuns.queryOptions({
      input: {
        jobId: jobId ?? "00000000-0000-0000-0000-000000000000",
        limit: CRON_RUN_PULSE_WINDOW,
      },
    }),
    enabled: jobId !== null,
  })
