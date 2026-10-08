import type { CronRunStatus } from "@/features/crons/shared/model/types"
import { useHydratedInfiniteQuery } from "@/hooks/use-hydrated-infinite-query"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

const CRON_RUNS_PAGE_SIZE = 30

export const useCronJobs = () =>
  useHydratedQuery(orpc.v1.cron.list.queryOptions())

export const useCronJob = (id: string | null) =>
  useHydratedQuery({
    ...orpc.v1.cron.get.queryOptions({
      input: { id: id ?? "00000000-0000-0000-0000-000000000000" },
    }),
    enabled: id !== null,
  })

// `status` is part of the input, so each filter gets its own query key and a
// fresh infinite list; omitting it lists every run.
export const useCronRuns = (jobId: string | null, status?: CronRunStatus) =>
  useHydratedInfiniteQuery({
    ...orpc.v1.cron.listRuns.infiniteOptions({
      input: (cursor: string | null) => ({
        jobId: jobId ?? "00000000-0000-0000-0000-000000000000",
        status,
        limit: CRON_RUNS_PAGE_SIZE,
        cursor,
      }),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }),
    enabled: jobId !== null,
  })
