import { getIcon } from "@/lib/icon-registry"

const UserRound = getIcon("identity", "user")

import { Text } from "@/components/shared/brand/typography"
import { MetadataDefinitionList } from "@/components/shared/data-display/metadata-cell"
import type { CronJob } from "@/features/crons/shared"
import { cronLabels } from "@/features/crons/shared"
import type { useAdminUser } from "@/hooks/use-admin-user"
import { formatDateTime } from "@/lib/format"

/** The cron detail page's identity/schedule metadata row (handler, cron
 *  expression, last/next run, runs-as identity). */
export function CronDetailMetadata({
  job,
  runsAsUser,
}: {
  job: CronJob
  runsAsUser: ReturnType<typeof useAdminUser>["data"]
}) {
  return (
    <MetadataDefinitionList
      columns={5}
      context={{ job, runsAsUser }}
      fields={[
        {
          key: "handler",
          label: "Handler",
          value: ({ job }) => (
            <Text as="code" variant="data">
              {job.handlerKey}
            </Text>
          ),
        },
        {
          key: "expression",
          label: "Expresión",
          value: ({ job }) => (
            <Text as="code" variant="data">
              {job.cronExpression}
            </Text>
          ),
        },
        {
          key: "lastRun",
          label: "Última ejecución",
          value: ({ job }) => (
            <span className="tabular-nums">
              {formatDateTime(job.lastRunAt, {
                includeSeconds: true,
                includeYear: true,
              })}
            </span>
          ),
        },
        {
          key: "nextRun",
          label: "Próxima ejecución",
          value: ({ job }) => (
            <span className="tabular-nums">
              {formatDateTime(job.nextRunAt, {
                includeSeconds: true,
                includeYear: true,
              })}
            </span>
          ),
        },
        {
          key: "runsAs",
          label: cronLabels.runsAs,
          value: ({ job, runsAsUser }) => (
            <span className="flex items-center gap-1.5">
              <UserRound className="size-3 shrink-0 text-muted-foreground/70" />
              {job.userId ? (
                <span className="min-w-0">
                  <span className="block truncate">
                    {runsAsUser?.name ?? job.userId}
                  </span>
                  {runsAsUser?.email ? (
                    <Text
                      variant="compact"
                      tone="muted"
                      className="block truncate"
                    >
                      {runsAsUser.email}
                    </Text>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground/70 italic">
                  {cronLabels.runsAsNobody}
                </span>
              )}
            </span>
          ),
        },
      ]}
    />
  )
}
