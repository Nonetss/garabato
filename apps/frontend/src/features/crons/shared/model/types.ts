export type CronJob = {
  id: string
  name: string
  description: string | null
  cronExpression: string
  timezone: string
  enabled: boolean
  handlerKey: string
  /** `code` jobs are declared by a procedure's `cron.schedule` meta and are
   *  read-only. */
  source: "manual" | "code"
  /** Route tags of the procedure behind the job. */
  tags: string[]
  userId: string | null
  payload: Record<string, unknown> | null
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}

export type CronCreateInput = {
  name: string
  description?: string | null
  cronExpression: string
  handlerKey: string
  enabled?: boolean
  userId?: string | null
  payload?: Record<string, unknown> | null
}

export type CronUpdateInput = {
  id: string
  name?: string
  description?: string | null
  cronExpression?: string
  handlerKey?: string
  userId?: string | null
  payload?: Record<string, unknown> | null
}

export type CronRunStatus = "running" | "success" | "failed" | "skipped"
