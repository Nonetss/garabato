import { getIcon } from "@/lib/icon-registry"

const Clock = getIcon("navigation", "crons")
const Loader2 = getIcon("status", "loading")
const Play = getIcon("actions", "run")
const Lock = getIcon("security", "locked")

import { StatusTag } from "@/components/shared/data-display/status-dot"
import { Hint } from "@/components/shared/feedback/hint"
import { StateCard } from "@/components/shared/feedback/state-card"
import { PageHero } from "@/components/shared/layout/page-hero"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/features/collections/favorites"
import { CollectionButton } from "@/features/collections/save"
import { CronDetailMetadata } from "@/features/crons/detail/components/cron-detail-metadata"
import { CronRunPulse } from "@/features/crons/detail/components/cron-run-pulse"
import {
  type CronRunFilter,
  CronRunTimeline,
} from "@/features/crons/detail/components/cron-run-timeline"
import { useCronRunEvents } from "@/features/crons/detail/hooks/use-cron-run-events"
import { useCronRunPulse } from "@/features/crons/detail/hooks/use-cron-run-pulse"
import {
  cronLabels,
  useCronJob,
  useCronRunNow,
  useCronRuns,
} from "@/features/crons/shared"
import { useAdminUser } from "@/hooks/use-admin-user"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { type QueryParamCodec, useQueryParam } from "@/hooks/use-query-param"
import { isAdminUser } from "@/lib/auth"
import { authClient } from "@/lib/auth-client"

// Unknown `?status=` values fall back to every run instead of an empty list.
const runFilterCodec: QueryParamCodec<CronRunFilter> = {
  parse: (raw) => (raw === "failed" || raw === "skipped" ? raw : "all"),
  serialize: (value) => value,
}

export function CronDetailContent({ jobId }: { jobId: string }) {
  const { data: job, isPending, isError, refetch } = useCronJob(jobId)
  const [runFilter, setRunFilter] = useQueryParam<CronRunFilter>(
    "status",
    "all",
    runFilterCodec
  )
  const {
    data: runsPages,
    isPending: runsPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useCronRuns(jobId, runFilter === "all" ? undefined : runFilter)
  const { data: pulse } = useCronRunPulse(jobId)
  useCronRunEvents(jobId)
  const { data: runsAsUser } = useAdminUser(job?.userId ?? null)
  const runs = runsPages?.pages.flatMap((page) => page.runs) ?? []
  const session = authClient.useSession()
  const isAdmin = isAdminUser(session.data?.user)
  const runNow = useCronRunNow(jobId)
  const sentinelRef = useInfiniteScroll(
    null,
    fetchNextPage,
    !!hasNextPage && !isFetchingNextPage
  )

  if (isError) {
    return (
      <StateCard
        icon={<Clock className="size-6" />}
        title="No se pudo cargar el cron"
        description="Comprueba tu conexión y tus permisos; si el problema continúa, inténtalo de nuevo más tarde."
        tone="destructive"
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        }
      />
    )
  }

  if (isPending || !job) {
    return <StateCard spinner title="Cargando cron..." />
  }

  const declaredInCode = job.source === "code"
  const entity = {
    entityType: "cron-job",
    entityId: job.id,
    metadata: {
      title: job.name,
      description: job.description ?? `Programa ${job.cronExpression}`,
      href: `/crons/${job.id}`,
    },
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHero
        surface="cron-detail"
        title={job.name}
        description={job.description ?? job.handlerKey}
        status={
          <span className="flex items-center gap-3">
            <StatusTag dotTone={job.enabled ? "primary" : "border"}>
              {job.enabled ? "Activo" : "Deshabilitado"}
            </StatusTag>
            {declaredInCode ? (
              <Hint label={cronLabels.declaredInCode}>
                <span
                  role="img"
                  aria-label={cronLabels.declaredInCode}
                  className="flex text-muted-foreground"
                >
                  <Lock className="size-3.5" aria-hidden="true" />
                </span>
              </Hint>
            ) : null}
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton entity={entity} />
            <CollectionButton entity={entity} />
            {isAdmin && !declaredInCode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={runNow.isPending}
                onClick={() => runNow.mutate()}
              >
                {runNow.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                {runNow.isPending
                  ? cronLabels.runNowPending
                  : cronLabels.runNow}
              </Button>
            ) : null}
          </div>
        }
      />

      <CronDetailMetadata job={job} runsAsUser={runsAsUser} />

      {pulse && pulse.runs.length > 0 ? (
        <CronRunPulse runs={pulse.runs} />
      ) : null}

      <CronRunTimeline
        runs={runs}
        filter={runFilter}
        onFilterChange={setRunFilter}
        isPending={runsPending}
        hasNextPage={!!hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        sentinelRef={sentinelRef}
      />
    </div>
  )
}
