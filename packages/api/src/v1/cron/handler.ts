import {
  CronNotFoundError,
  CronReadOnlyError,
  CronValidationError,
} from "@nonete/cron"
import type { cronJob, cronRun } from "@nonete/db/schema/cron"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { toIso, toIsoOrNull } from "#shared/dates"
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  paginate,
} from "#shared/pagination"
import { cronTagsForKey, listCronHandlers } from "#v1/cron/discovery"
import { cronRunEventsSignal, subscribeCronRunChanges } from "#v1/cron/events"
import type { cronInput } from "#v1/cron/input"
import type { cronOutput } from "#v1/cron/output"
import { getCronService } from "#v1/cron/runtime"

function toJob(row: typeof cronJob.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    enabled: row.enabled,
    handlerKey: row.handlerKey,
    source: row.source,
    tags: cronTagsForKey(row.handlerKey),
    userId: row.userId,
    payload: row.payload ?? null,
    lastRunAt: toIsoOrNull(row.lastRunAt),
    nextRunAt: toIsoOrNull(row.nextRunAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

function toRun(row: typeof cronRun.$inferSelect) {
  return {
    id: row.id,
    jobId: row.jobId,
    status: row.status,
    handlerKey: row.handlerKey,
    startedAt: toIso(row.startedAt),
    finishedAt: toIsoOrNull(row.finishedAt),
    errorMessage: row.errorMessage,
    result: row.result ?? null,
  }
}

async function withCronErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof CronNotFoundError) {
      throw errors.NOT_FOUND({ message: error.message })
    }
    if (error instanceof CronReadOnlyError) {
      throw errors.CONFLICT({
        message: "Este cron está declarado en código y no se puede modificar",
      })
    }
    if (error instanceof CronValidationError) {
      throw errors.BAD_REQUEST({ message: error.message })
    }
    throw error
  }
}

export const cronHandler = {
  async list() {
    const rows = await getCronService().list()
    return rows.map(toJob)
  },

  async get({ input }: { input: z.infer<typeof cronInput.get> }) {
    return withCronErrors(async () => {
      const row = await getCronService().get(input.id)
      return toJob(row)
    })
  },

  async create({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof cronInput.create>
  }) {
    return withCronErrors(async () => {
      const row = await getCronService().create({
        name: input.name,
        description: input.description,
        cronExpression: input.cronExpression,
        handlerKey: input.handlerKey,
        enabled: input.enabled,
        // Omitting userId binds the job to its creator; an explicit null opts
        // out and runs it with no user at all.
        userId: input.userId === undefined ? context.user?.id : input.userId,
        payload: input.payload,
        timezone: "UTC",
      })
      return toJob(row)
    })
  },

  async setEnabled({ input }: { input: z.infer<typeof cronInput.setEnabled> }) {
    return withCronErrors(async () => {
      const row = await getCronService().setEnabled(input.id, input.enabled)
      return toJob(row)
    })
  },

  async update({ input }: { input: z.infer<typeof cronInput.update> }) {
    return withCronErrors(async () => {
      const { id, ...patch } = input
      const row = await getCronService().update(id, patch)
      return toJob(row)
    })
  },

  async remove({ input }: { input: z.infer<typeof cronInput.remove> }) {
    return withCronErrors(async () => {
      await getCronService().remove(input.id)
      return { id: input.id }
    })
  },

  async runNow({ input }: { input: z.infer<typeof cronInput.runNow> }) {
    return withCronErrors(async () => {
      const row = await getCronService().runNow(input.id)
      return toRun(row)
    })
  },

  async listRuns({ input }: { input: z.infer<typeof cronInput.listRuns> }) {
    const cursor = decodeKeysetCursor(input.cursor)
    const rows = await getCronService().listRuns({
      jobId: input.jobId,
      status: input.status,
      limit: input.limit + 1,
      cursor: cursor && { startedAt: cursor.timestamp, id: cursor.id },
    })
    const { page, hasMore, lastRow } = paginate(rows, input.limit)
    return {
      runs: page.map(toRun),
      nextCursor:
        hasMore && lastRow
          ? encodeKeysetCursor(lastRow.startedAt, lastRow.id)
          : null,
    }
  },

  async handlers() {
    return listCronHandlers()
  },

  /**
   * Streams the job's run changes until the caller leaves or the backend
   * shuts down. Subscribes before sending `subscribed`, so nothing published
   * after that event is missed; the client refetches on it to cover what
   * happened before.
   */
  async *watchRuns({
    input,
    signal,
  }: {
    input: z.infer<typeof cronInput.watchRuns>
    signal?: AbortSignal
  }): AsyncGenerator<z.infer<typeof cronOutput.runEvent>> {
    await withCronErrors(() => getCronService().get(input.jobId))

    const stop = cronRunEventsSignal(signal)
    if (stop.aborted) return
    const changes = subscribeCronRunChanges(stop)

    yield { type: "subscribed" }

    try {
      for await (const change of changes) {
        if (change.jobId !== input.jobId) continue
        yield { type: "run", runId: change.runId, status: change.status }
      }
    } catch (error) {
      // The subscription throws the abort reason: a client that left or a
      // shutdown ends the stream normally, not as a failure.
      if (stop.aborted) return
      throw error
    }
  },
}
