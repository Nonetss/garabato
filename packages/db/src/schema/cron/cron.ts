import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "#schema/auth"

export const cronRunStatusEnum = pgEnum("cron_run_status", [
  "running",
  "success",
  "failed",
  "skipped",
])

// Where a job's definition comes from: `manual` jobs are created through the
// API; `code` jobs are synced at startup from a procedure's
// `cron.schedule` meta and are read-only everywhere else.
export const cronJobSourceEnum = pgEnum("cron_job_source", ["manual", "code"])

export const cronJob = pgTable(
  "cron_job",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    cronExpression: text("cron_expression").notNull(),
    // Bun.cron schedules in UTC only; non-UTC values are rejected by the
    // service.
    timezone: text("timezone").default("UTC").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    handlerKey: text("handler_key").notNull(),
    source: cronJobSourceEnum("source").default("manual").notNull(),
    // The user the scheduler impersonates when firing this job: it creates a
    // real session for them, so the handler runs with their permissions.
    // Null means the job runs with no user (cron-only procedures).
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    // Soft delete: runs stay attached to the job (no cascade) so their
    // history survives; null means the job is active.
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cronJob_userId_idx").on(table.userId),
    // Partial unique index instead of a plain unique column: a soft-deleted
    // job's name must free up for reuse.
    uniqueIndex("cronJob_name_idx")
      .on(table.name)
      .where(sql`${table.deletedAt} is null`),
    // One active code-declared job per procedure.
    uniqueIndex("cronJob_codeHandlerKey_idx")
      .on(table.handlerKey)
      .where(sql`${table.source} = 'code' and ${table.deletedAt} is null`),
  ]
)

export const cronRun = pgTable(
  "cron_run",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => cronJob.id, { onDelete: "cascade" }),
    status: cronRunStatusEnum("status").notNull(),
    handlerKey: text("handler_key").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    errorMessage: text("error_message"),
    result: jsonb("result"),
  },
  (table) => [
    index("cronRun_jobId_idx").on(table.jobId),
    index("cronRun_startedAt_idx").on(table.startedAt),
    index("cronRun_jobId_startedAt_idx").on(table.jobId, table.startedAt),
  ]
)
