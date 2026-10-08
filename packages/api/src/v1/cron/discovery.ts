import {
  type AnyProcedure,
  getRouter,
  Procedure,
  walkProcedureContractsSync,
} from "@orpc/server"

import { errors } from "#errors"
import { type CronMeta, getCronMeta } from "#index"
import {
  type ProcedureDocs,
  procedureDocs,
  procedureInputJsonSchema,
} from "#shared/procedure-docs"
import { appRouter as v1Router } from "#v1/router"

export type CronHandlerInfo = {
  key: string
  summary?: string
  description?: string
  tags: string[]
  inputSchema: Record<string, unknown> | null
}

export type DeclaredCronSchedule = {
  key: string
  cronExpression: string
  /** Job name and description, already resolved against their defaults. */
  name: string
  description: string | null
  tags: string[]
}

type DeclaredSchedule = Extract<CronMeta, { schedule: string }>

function isCronEligible(meta: CronMeta | undefined): boolean {
  return meta !== undefined && meta.eligible === true
}

function isDeclaredSchedule(
  meta: CronMeta | undefined
): meta is DeclaredSchedule {
  return meta !== undefined && meta.schedule !== undefined
}

/** Eligible or code-scheduled: anything the scheduler may execute. */
function isCronRunnable(meta: CronMeta | undefined): boolean {
  return isCronEligible(meta) || isDeclaredSchedule(meta)
}

/** Job name: the declared one, or the procedure key. */
function declaredJobName(schedule: DeclaredSchedule, key: string): string {
  if (schedule.name !== undefined) return schedule.name
  return key
}

/** Job description: declared, else the route's description, else its summary. */
function declaredJobDescription(
  schedule: DeclaredSchedule,
  docs: ProcedureDocs
): string | null {
  if (schedule.description !== undefined) return schedule.description
  if (docs.description !== undefined) return docs.description
  if (docs.summary !== undefined) return docs.summary
  return null
}

type Discovered = {
  handlers: CronHandlerInfo[]
  schedules: DeclaredCronSchedule[]
}

let cached: Discovered | null = null

function discover(): Discovered {
  if (cached) return cached
  const out: Discovered = { handlers: [], schedules: [] }

  walkProcedureContractsSync(v1Router, (procedure, path) => {
    const meta = getCronMeta(procedure)
    const docs = procedureDocs(procedure)
    const key = path.join(".")

    if (isDeclaredSchedule(meta)) {
      out.schedules.push({
        key,
        cronExpression: meta.schedule,
        name: declaredJobName(meta, key),
        description: declaredJobDescription(meta, docs),
        tags: docs.tags,
      })
      return
    }

    if (!isCronEligible(meta)) return

    out.handlers.push({
      key,
      summary: docs.summary,
      description: docs.description,
      tags: docs.tags,
      inputSchema: procedureInputJsonSchema(procedure),
    })
  })

  out.handlers.sort((a, b) => a.key.localeCompare(b.key))
  out.schedules.sort((a, b) => a.key.localeCompare(b.key))
  cached = out
  return out
}

/** Discover cron-eligible procedures under `v1Router` (keys relative to it). */
export function listCronHandlers(): CronHandlerInfo[] {
  return discover().handlers
}

/** Procedures under `v1Router` that declare their own `cron.schedule`. */
export function listDeclaredCronSchedules(): DeclaredCronSchedule[] {
  return discover().schedules
}

/**
 * Route tags of the procedure behind a job, eligible or code-scheduled; empty
 * when the key no longer resolves.
 */
export function cronTagsForKey(key: string): string[] {
  const { handlers, schedules } = discover()

  const handler = handlers.find((candidate) => candidate.key === key)
  if (handler !== undefined) return handler.tags

  const schedule = schedules.find((candidate) => candidate.key === key)
  if (schedule !== undefined) return schedule.tags

  return []
}

export function isCronHandlerKey(key: string): boolean {
  return listCronHandlers().some((handler) => handler.key === key)
}

/**
 * Resolve a cron-eligible or code-scheduled procedure by dot path, or throw
 * NOT_FOUND.
 */
export function resolveCronProcedure(key: string): AnyProcedure {
  const segments = key.split(".").filter(Boolean)
  if (segments.length === 0) {
    throw errors.NOT_FOUND({
      message: `No cron handler registered for key: ${key}`,
    })
  }

  const node = getRouter(v1Router, segments)
  if (!(node instanceof Procedure)) {
    throw errors.NOT_FOUND({
      message: `No cron handler registered for key: ${key}`,
    })
  }

  if (!isCronRunnable(getCronMeta(node))) {
    throw errors.NOT_FOUND({
      message: `No cron handler registered for key: ${key}`,
    })
  }

  return node
}
