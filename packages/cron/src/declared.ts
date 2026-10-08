import { cronJob } from "@nonete/db/schema/cron"
import type { logger as rootLogger } from "@nonete/logger"
import { eq } from "drizzle-orm"

import { assertValidCronExpression, nextRunAt } from "#cron-expression"
import { isUniqueViolation } from "#errors"
import type { Db } from "#service"

/** A schedule declared in code through a procedure's `cron.schedule` meta. */
export type DeclaredCronJob = {
  key: string
  cronExpression: string
  name: string
  description: string | null
}

export type SyncDeclaredJobsOptions = {
  db: Db
  declared: DeclaredCronJob[]
  logger: typeof rootLogger
  /**
   * The user every `code` job runs as, through the scheduler's impersonation
   * path; null runs them with no user.
   */
  runAsUserId: string | null
}

/**
 * Reconciles the persisted `code` jobs with the schedules declared in code.
 * This is the only writer of `code` jobs: the service rejects every API
 * mutation on them. Runs once at startup, before the scheduler starts.
 */
export async function syncDeclaredJobs({
  db,
  declared,
  logger,
  runAsUserId,
}: SyncDeclaredJobsOptions): Promise<void> {
  const log = logger.child({ service: "cron" })

  const active = await db.query.cronJob.findMany({
    where: { source: "code", deletedAt: { isNull: true } },
  })
  const activeByKey = new Map(active.map((job) => [job.handlerKey, job]))
  const declaredKeys = new Set(declared.map((schedule) => schedule.key))

  for (const job of active) {
    if (declaredKeys.has(job.handlerKey)) continue
    // Soft delete keeps the run history, same as a manual removal.
    await db
      .update(cronJob)
      .set({ deletedAt: new Date(), enabled: false, nextRunAt: null })
      .where(eq(cronJob.id, job.id))
    log.info(
      { jobId: job.id, handlerKey: job.handlerKey },
      "removed code-declared cron job no longer declared in code"
    )
  }

  for (const schedule of declared) {
    const existing = activeByKey.get(schedule.key)
    const scheduleLog = log.child({
      handlerKey: schedule.key,
      cronExpression: schedule.cronExpression,
    })

    try {
      assertValidCronExpression(schedule.cronExpression)
    } catch (err) {
      scheduleLog.error({ err }, "invalid cron schedule declared in code")
      if (existing?.enabled) {
        await db
          .update(cronJob)
          .set({ enabled: false, nextRunAt: null })
          .where(eq(cronJob.id, existing.id))
      }
      continue
    }

    try {
      if (!existing) {
        const [row] = await db
          .insert(cronJob)
          .values({
            name: schedule.name,
            description: schedule.description,
            cronExpression: schedule.cronExpression,
            timezone: "UTC",
            enabled: true,
            handlerKey: schedule.key,
            source: "code",
            userId: runAsUserId,
            payload: null,
            nextRunAt: nextRunAt(schedule.cronExpression),
          })
          .returning({ id: cronJob.id })
        scheduleLog.info({ jobId: row?.id }, "created code-declared cron job")
        continue
      }

      if (
        existing.enabled &&
        existing.cronExpression === schedule.cronExpression &&
        existing.name === schedule.name &&
        existing.description === schedule.description &&
        existing.userId === runAsUserId
      ) {
        continue
      }

      await db
        .update(cronJob)
        .set({
          cronExpression: schedule.cronExpression,
          name: schedule.name,
          description: schedule.description,
          userId: runAsUserId,
          enabled: true,
          nextRunAt: nextRunAt(schedule.cronExpression),
        })
        .where(eq(cronJob.id, existing.id))
      scheduleLog.info({ jobId: existing.id }, "updated code-declared cron job")
    } catch (err) {
      if (isUniqueViolation(err)) {
        scheduleLog.error(
          { err, name: schedule.name },
          "another cron job already uses this name; rename one of them so the code-declared schedule can run"
        )
        continue
      }
      scheduleLog.error({ err }, "failed to sync code-declared cron job")
    }
  }
}
