import { getIcon } from "@/lib/icon-registry"

const UserRound = getIcon("identity", "user")

import { Text } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import { IconButton } from "@/components/shared/form/icon-button"
import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import type { CronJob } from "@/features/crons/shared"
import { cronLabels, useCronSetEnabled } from "@/features/crons/shared"
import { formatDateTime } from "@/lib/format"
import { iconRef } from "@/lib/icon-registry"

const PlayIcon = getIcon("actions", "run")
const PauseIcon = getIcon("actions", "pause")
const LockIcon = getIcon("security", "locked")

export interface CronsRowContext {
  isAdmin: boolean
  handlerKeys: Set<string>
  usersById: Map<string, { name?: string | null }>
  onEdit: (job: CronJob) => void
  onDelete: (job: CronJob) => void
}

const isDeclaredInCode = (job: CronJob) => job.source === "code"

function CronRowRunsAs({
  userId,
  user,
}: {
  userId: string | null
  user: { name?: string | null } | undefined
}) {
  if (!userId) {
    return (
      <span className="text-muted-foreground/70 italic">
        {cronLabels.runsAsNobody}
      </span>
    )
  }
  return <span className="truncate">{user?.name ?? userId}</span>
}

function CronRowEnabledToggle({ job }: { job: CronJob }) {
  const setEnabled = useCronSetEnabled(job.id)
  const Icon = job.enabled ? PauseIcon : PlayIcon
  const hint = job.enabled ? "Pausar" : "Reanudar"
  return (
    <IconButton
      label={hint}
      accessibleLabel={`${hint} ${job.name}`}
      icon={Icon}
      className="text-muted-foreground"
      disabled={setEnabled.isPending}
      aria-pressed={job.enabled}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setEnabled.mutate({ id: job.id, enabled: !job.enabled })
      }}
    />
  )
}

/** Sits in the pause/resume slot so code-declared rows keep their alignment. */
function CronRowLockedMarker() {
  return (
    <Hint label={cronLabels.declaredInCode}>
      <span
        role="img"
        aria-label={cronLabels.declaredInCode}
        className="flex size-8 items-center justify-center text-muted-foreground"
      >
        <LockIcon className="size-3.5" aria-hidden="true" />
      </span>
    </Hint>
  )
}

function CronRowTrailingActions({
  job,
  isAdmin,
}: {
  job: CronJob
  isAdmin: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {isDeclaredInCode(job) ? (
        <CronRowLockedMarker />
      ) : isAdmin ? (
        <CronRowEnabledToggle job={job} />
      ) : null}
    </div>
  )
}

/** The crons overview's `EntityList` row definition: name/handler,
 *  status/toggle, schedule metadata and the edit/delete actions. */
export const cronJobDefinition: EntityListDefinition<CronJob, CronsRowContext> =
  {
    getKey: (job) => job.id,
    getAccessibleLabel: (job) => job.name,
    getPrimary: (job) => job.name,
    getSecondary: (job, ctx) =>
      isDeclaredInCode(job) || ctx.handlerKeys.has(job.handlerKey) ? (
        <Text variant="data">{job.handlerKey}</Text>
      ) : (
        <span className="text-destructive">
          {cronLabels.handlerUnavailable}
        </span>
      ),
    getOpenHref: (job) => `/crons/${job.id}`,
    getStatus: (job) => ({
      tone: job.enabled ? "primary" : "border",
      label: job.enabled ? "Activo" : "Pausa",
    }),
    // Code-declared jobs read as dimmed, background machinery.
    isMuted: (job) => !job.enabled || isDeclaredInCode(job),
    renderTrailing: (job, ctx) => (
      <CronRowTrailingActions job={job} isAdmin={ctx.isAdmin} />
    ),
    metadata: [
      {
        key: "expr",
        label: "Expresión",
        value: (job) => (
          <Text as="code" variant="data">
            {job.cronExpression}
          </Text>
        ),
      },
      {
        key: "runsAs",
        label: cronLabels.runsAs,
        value: (job, ctx) => (
          <span className="flex items-center gap-1.5">
            <UserRound className="size-3 shrink-0 text-muted-foreground/70" />
            <CronRowRunsAs
              userId={job.userId}
              user={job.userId ? ctx.usersById.get(job.userId) : undefined}
            />
          </span>
        ),
      },
      {
        key: "last",
        label: "Última",
        value: (job) => (
          <span className="text-muted-foreground tabular-nums">
            {formatDateTime(job.lastRunAt)}
          </span>
        ),
      },
      {
        key: "next",
        label: "Próxima",
        value: (job) => (
          <span className="tabular-nums">{formatDateTime(job.nextRunAt)}</span>
        ),
      },
    ],
    actions: [
      {
        key: "edit",
        label: cronLabels.edit,
        icon: iconRef("actions", "edit"),
        hidden: (job, ctx) => !ctx.isAdmin || isDeclaredInCode(job),
        onSelect: (job, ctx) => ctx.onEdit(job),
      },
      {
        key: "delete",
        label: cronLabels.delete,
        icon: iconRef("actions", "delete"),
        destructive: true,
        hidden: (job, ctx) => !ctx.isAdmin || isDeclaredInCode(job),
        onSelect: (job, ctx) => ctx.onDelete(job),
      },
    ],
  }
