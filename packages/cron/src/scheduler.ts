import { cronJob, cronRun } from "@nonete/db/schema/cron"
import type { logger as rootLogger } from "@nonete/logger"
import { and, eq } from "drizzle-orm"

import { nextRunAt } from "#cron-expression"
import { CronNotFoundError, CronValidationError } from "#errors"
import type { Db } from "#service"

type CronLogger = typeof rootLogger

export type CronResolver = (
  key: string,
  ctx: {
    jobId: string
    jobName: string
    /** The user whose permissions the job runs with; null for none. */
    userId: string | null
    payload: Record<string, unknown> | null
  }
) => Promise<unknown>

/** A run that just started, finished or was skipped. */
export type CronRunChange = {
  jobId: string
  runId: string
  status: (typeof cronRun.$inferSelect)["status"]
}

export type CronScheduler = {
  start: () => Promise<void>
  stop: () => Promise<void>
  refresh: () => Promise<void>
  /**
   * Runs a job immediately, outside its schedule, regardless of its enabled
   * flag. Returns as soon as the `running` row is recorded — execution
   * continues in the background, same as a scheduled fire.
   */
  runNow: (jobId: string) => Promise<typeof cronRun.$inferSelect>
}

export type CreateSchedulerOptions = {
  db: Db
  resolve: CronResolver
  logger: CronLogger
  /** How often to reload job definitions from the DB (ms). Default 30s. */
  pollIntervalMs?: number
  /**
   * Called after every `cron_run` write: the `running` insert, the
   * `success`/`failed` update (once the job's lastRunAt/nextRunAt are
   * updated too) and the `skipped` insert. Never awaited, and a failure is
   * only logged, so a listener can't delay or change a run.
   */
  onRunChange?: (change: CronRunChange) => void | Promise<void>
}

type ScheduledEntry = {
  jobId: string
  signature: string
  cron: Bun.CronJob
}

function jobSignature(job: {
  cronExpression: string
  handlerKey: string
  enabled: boolean
  payload: Record<string, unknown> | null
}): string {
  return JSON.stringify({
    cronExpression: job.cronExpression,
    handlerKey: job.handlerKey,
    enabled: job.enabled,
    payload: job.payload,
  })
}

export function createScheduler({
  db,
  resolve,
  logger,
  pollIntervalMs = 30_000,
  onRunChange,
}: CreateSchedulerOptions): CronScheduler {
  const log = logger.child({ service: "cron" })
  const scheduled = new Map<string, ScheduledEntry>()
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let started = false

  const notifyRunChange = (change: CronRunChange) => {
    if (!onRunChange) return
    // Wrapped in a promise so a synchronous throw and a rejection end up in
    // the same catch.
    void Promise.resolve()
      .then(() => onRunChange(change))
      .catch((err) => {
        log.warn(
          { err, jobId: change.jobId, runId: change.runId },
          "cron run change listener failed"
        )
      })
  }

  const stopEntry = (entry: ScheduledEntry) => {
    entry.cron.stop()
    scheduled.delete(entry.jobId)
  }

  const findRunningRun = (jobId: string) =>
    db.query.cronRun.findFirst({
      where: {
        jobId,
        status: "running",
      },
    })

  const insertRunningRun = async (job: typeof cronJob.$inferSelect) => {
    const [row] = await db
      .insert(cronRun)
      .values({
        jobId: job.id,
        status: "running",
        handlerKey: job.handlerKey,
        startedAt: new Date(),
      })
      .returning()
    if (row) {
      notifyRunChange({ jobId: job.id, runId: row.id, status: "running" })
    }
    return row
  }

  const jobLogger = (job: typeof cronJob.$inferSelect) =>
    log.child({
      jobId: job.id,
      jobName: job.name,
      handlerKey: job.handlerKey,
      userId: job.userId,
    })

  // Calls the resolved handler for an already-recorded `running` row and
  // updates it (and the job's lastRunAt/nextRunAt) with the outcome. Shared
  // by the scheduled fire path and manual "run now" triggers.
  const performRun = async (
    job: typeof cronJob.$inferSelect,
    run: typeof cronRun.$inferSelect,
    jobLog: CronLogger
  ) => {
    const startedAt = run.startedAt

    try {
      const handlerResult = await resolve(job.handlerKey, {
        jobId: job.id,
        jobName: job.name,
        userId: job.userId ?? null,
        payload: job.payload ?? null,
      })

      let result: unknown = null
      if (handlerResult !== undefined) {
        try {
          // Round-trip to guarantee the value is jsonb-safe (no functions,
          // circular refs, etc.) before it ever reaches the insert.
          result = JSON.parse(JSON.stringify(handlerResult))
        } catch (err) {
          jobLog.warn(
            { err },
            "cron job result could not be serialized to JSON, storing null"
          )
        }
      }

      const finishedAt = new Date()
      await db
        .update(cronRun)
        .set({
          status: "success",
          finishedAt,
          result,
        })
        .where(eq(cronRun.id, run.id))

      await db
        .update(cronJob)
        .set({
          lastRunAt: startedAt,
          // A manual "run now" on a disabled job must not resurrect its
          // nextRunAt — it stays unscheduled until re-enabled.
          nextRunAt: job.enabled
            ? nextRunAt(job.cronExpression, finishedAt)
            : null,
        })
        .where(eq(cronJob.id, job.id))

      notifyRunChange({ jobId: job.id, runId: run.id, status: "success" })

      jobLog.info(
        {
          runId: run.id,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
        "cron job succeeded"
      )
    } catch (err) {
      const finishedAt = new Date()
      const errorMessage = err instanceof Error ? err.message : String(err)

      await db
        .update(cronRun)
        .set({
          status: "failed",
          finishedAt,
          errorMessage,
        })
        .where(eq(cronRun.id, run.id))

      await db
        .update(cronJob)
        .set({
          lastRunAt: startedAt,
          nextRunAt: job.enabled
            ? nextRunAt(job.cronExpression, finishedAt)
            : null,
        })
        .where(eq(cronJob.id, job.id))

      notifyRunChange({ jobId: job.id, runId: run.id, status: "failed" })

      jobLog.error(
        {
          runId: run.id,
          err,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
        "cron job failed"
      )
    }
  }

  const executeJob = async (jobId: string) => {
    const job = await db.query.cronJob.findFirst({
      where: { id: jobId },
    })

    if (!job?.enabled) {
      return
    }

    const jobLog = jobLogger(job)

    // Bun.cron already waits for the previous handler to settle (no stack),
    // but a crashed process can leave a `running` row — skip until recovered.
    const existingRunning = await findRunningRun(job.id)

    if (existingRunning) {
      const [skipped] = await db
        .insert(cronRun)
        .values({
          jobId: job.id,
          status: "skipped",
          handlerKey: job.handlerKey,
          startedAt: new Date(),
          finishedAt: new Date(),
          errorMessage: "Previous run still in progress",
        })
        .returning({ id: cronRun.id })
      if (skipped) {
        notifyRunChange({ jobId: job.id, runId: skipped.id, status: "skipped" })
      }
      jobLog.warn("cron job skipped: previous run still in progress")
      return
    }

    const run = await insertRunningRun(job)
    if (!run) {
      jobLog.error("failed to create cron_run row")
      return
    }

    await performRun(job, run, jobLog)
  }

  const runJobNow = async (jobId: string) => {
    const job = await db.query.cronJob.findFirst({
      where: { id: jobId },
    })

    if (!job) {
      throw new CronNotFoundError(`Cron job not found: ${jobId}`)
    }

    const jobLog = jobLogger(job)

    const existingRunning = await findRunningRun(job.id)
    if (existingRunning) {
      throw new CronValidationError("A run is already in progress for this job")
    }

    const run = await insertRunningRun(job)
    if (!run) {
      throw new Error("failed to create cron_run row")
    }

    jobLog.info({ runId: run.id }, "cron job manually triggered")

    // Not awaited: the caller (an admin action) gets the `running` row back
    // immediately, same as a scheduled fire that isn't blocking anything.
    void performRun(job, run, jobLog).catch((err) => {
      jobLog.error({ err }, "unexpected error while executing manual cron run")
    })

    return run
  }

  const syncJobs = async () => {
    const jobs = await db.query.cronJob.findMany({
      where: { enabled: true },
    })

    const enabledIds = new Set(jobs.map((j) => j.id))

    for (const [jobId, entry] of scheduled) {
      if (!enabledIds.has(jobId)) {
        stopEntry(entry)
        log.info({ jobId }, "unscheduled disabled or deleted cron job")
      }
    }

    for (const job of jobs) {
      const signature = jobSignature(job)
      const existing = scheduled.get(job.id)

      if (existing && existing.signature === signature) {
        continue
      }

      if (existing) {
        stopEntry(existing)
      }

      try {
        // Await the handler so Bun's no-overlap waits on DB work + handler,
        // and failures stay inside our try/catch (not unhandledRejection).
        const cron = Bun.cron(job.cronExpression, async () => {
          await executeJob(job.id)
        })

        scheduled.set(job.id, { jobId: job.id, signature, cron })

        const next = nextRunAt(job.cronExpression)
        if (next) {
          await db
            .update(cronJob)
            .set({ nextRunAt: next })
            .where(eq(cronJob.id, job.id))
        }

        log.info(
          {
            jobId: job.id,
            jobName: job.name,
            cronExpression: job.cronExpression,
            nextRunAt: next,
          },
          "scheduled cron job"
        )
      } catch (err) {
        log.error(
          { jobId: job.id, jobName: job.name, err },
          "failed to schedule cron job"
        )
      }
    }
  }

  return {
    async start() {
      if (started) {
        return
      }
      started = true
      await syncJobs()
      pollTimer = setInterval(() => {
        void syncJobs().catch((err) => {
          log.error({ err }, "cron scheduler poll failed")
        })
      }, pollIntervalMs)
      log.info({ pollIntervalMs }, "cron scheduler started")
    },

    async stop() {
      if (!started) {
        return
      }
      started = false
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      for (const entry of scheduled.values()) {
        entry.cron.stop()
      }
      scheduled.clear()
      log.info("cron scheduler stopped")
    },

    async refresh() {
      await syncJobs()
    },

    runNow: runJobNow,
  }
}

/** Mark orphaned `running` rows as failed after a process restart. */
export async function recoverOrphanedRuns(db: Db, logger: CronLogger) {
  const log = logger.child({ service: "cron" })
  const result = await db
    .update(cronRun)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: "Process restarted while run was in progress",
    })
    .where(and(eq(cronRun.status, "running")))
    .returning({ id: cronRun.id })

  if (result.length > 0) {
    log.warn(
      { count: result.length, runIds: result.map((r) => r.id) },
      "recovered orphaned cron runs"
    )
  }
}
