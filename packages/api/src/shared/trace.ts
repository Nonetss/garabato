import type { db } from "@nonete/db"
import {
  type TraceDetails,
  type TraceType,
  traceEvents,
} from "@nonete/db/schema"

import type { Context } from "#context"
import { clientIp } from "#shared/client-ip"

/** One action to trace; the user, time and client IP are filled in. */
export type TraceInput = {
  type: TraceType
  documentId?: string
  certificateId?: string
  versionId?: string
  details?: TraceDetails
}

/** `db` or the transaction the traced action runs in. */
type TraceExecutor = Pick<typeof db, "insert">

/**
 * Writes the traces of the caller's action. Pass the action's transaction so
 * the action never commits without its traces, nor the traces without it.
 */
export async function recordTraces(
  executor: TraceExecutor,
  context: Context,
  userId: string,
  traces: TraceInput[]
) {
  if (traces.length === 0) return
  const ipAddress = clientIp(context)
  await executor.insert(traceEvents).values(
    traces.map((trace) => ({
      userId,
      type: trace.type,
      documentId: trace.documentId,
      certificateId: trace.certificateId,
      versionId: trace.versionId,
      ipAddress,
      details: trace.details,
    }))
  )
}
