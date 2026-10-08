import {
  isCronHandlerKey,
  listCronHandlers,
  listDeclaredCronSchedules,
  resolveCronProcedure,
} from "@nonete/api/v1/cron/discovery"
import { publishCronRunChange } from "@nonete/api/v1/cron/events"
import { bindCronService } from "@nonete/api/v1/cron/runtime"
import { createUserSession } from "@nonete/auth/session"
import {
  createCronService,
  createScheduler,
  type DeclaredCronJob,
  recoverOrphanedRuns,
  syncDeclaredJobs,
} from "@nonete/cron"
import { db } from "@nonete/db"
import { env } from "@nonete/env/server"
import { logger } from "@nonete/logger"
import { call } from "@orpc/server"

import { type DeclaredJobsRunAs, resolveDeclaredJobsRunAs } from "@/cron/run-as"

const resolve = async (
  key: string,
  ctx: {
    jobId: string
    jobName: string
    userId: string | null
    payload: Record<string, unknown> | null
  }
) => {
  const procedure = resolveCronProcedure(key)
  const cron = { jobId: ctx.jobId, jobName: ctx.jobName }
  const input = ctx.payload ?? {}

  if (!ctx.userId) {
    return call(procedure, input, {
      context: {
        user: null,
        session: null,
        headers: new Headers(),
        cron,
      },
    })
  }

  // Jobs bound to a user run with that user's permissions: a real session is
  // created for the run and revoked right after, so protected/admin procedures
  // and any `auth.api.*` call made with these headers see them as the caller.
  const impersonated = await createUserSession(ctx.userId)

  try {
    return await call(procedure, input, {
      context: {
        user: impersonated.user,
        session: impersonated.session,
        headers: impersonated.headers,
        cron,
      },
    })
  } finally {
    await impersonated.revoke().catch((err) => {
      logger.error(
        { err, jobId: ctx.jobId, userId: ctx.userId },
        "failed to revoke the cron impersonation session"
      )
    })
  }
}

export const cronScheduler = createScheduler({
  db,
  resolve,
  logger,
  // Feeds `v1.cron.watchRuns`, which keeps open cron detail pages current.
  onRunChange: publishCronRunChange,
})

export const cronService = createCronService({
  db,
  onChange: () => cronScheduler.refresh(),
  isValidHandlerKey: isCronHandlerKey,
  triggerRun: (id) => cronScheduler.runNow(id),
})

bindCronService(cronService)

async function resolveRunAsUserId(
  declared: DeclaredCronJob[]
): Promise<string | null> {
  let runAs: DeclaredJobsRunAs | null = null
  try {
    runAs = await resolveDeclaredJobsRunAs(env.ADMIN_EMAIL)
  } catch (err) {
    logger.error(
      { err },
      "failed to resolve the code-declared cron run-as user"
    )
  }

  if (!runAs) {
    if (declared.length > 0) {
      logger.warn(
        { jobs: declared.map((schedule) => schedule.name) },
        "code-declared cron jobs have no run-as user; set ADMIN_EMAIL to an existing admin or protected jobs will fail as Unauthorized"
      )
    }
    return null
  }

  if (runAs.role !== "admin") {
    logger.warn(
      { userId: runAs.userId, role: runAs.role },
      "the ADMIN_EMAIL user code-declared cron jobs run as is not an admin; admin-only jobs will fail as Forbidden"
    )
  }
  return runAs.userId
}

async function syncCodeDeclaredJobs(): Promise<void> {
  try {
    const declared = listDeclaredCronSchedules()
    await syncDeclaredJobs({
      db,
      declared,
      logger,
      runAsUserId: await resolveRunAsUserId(declared),
    })
  } catch (err) {
    logger.error({ err }, "failed to sync code-declared cron jobs")
  }
}

async function reportCronConsistency(): Promise<void> {
  // Code-declared jobs are reconciled by the sync, not reported here.
  const jobs = await db.query.cronJob.findMany({
    where: { source: "manual" },
  })
  for (const job of jobs) {
    if (!isCronHandlerKey(job.handlerKey)) {
      logger.warn(
        {
          jobId: job.id,
          jobName: job.name,
          handlerKey: job.handlerKey,
        },
        "cron job handler key no longer resolves to an eligible procedure"
      )
    }
  }

  for (const handler of listCronHandlers()) {
    try {
      resolveCronProcedure(handler.key)
    } catch (err) {
      logger.error(
        { handlerKey: handler.key, err },
        "cron-eligible procedure could not be resolved for the scheduler"
      )
    }
  }

  for (const schedule of listDeclaredCronSchedules()) {
    try {
      resolveCronProcedure(schedule.key)
    } catch (err) {
      logger.error(
        { handlerKey: schedule.key, err },
        "code-scheduled procedure could not be resolved for the scheduler"
      )
    }
  }
}

export async function startCron(): Promise<void> {
  await recoverOrphanedRuns(db, logger)
  await syncCodeDeclaredJobs()
  await reportCronConsistency()
  await cronScheduler.start()
}
