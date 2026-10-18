import type { db } from "#index"
import { type TraceDetails, type TraceType, traceEvents } from "#schema"

/** One action to trace; the user, time and client IP are filled in. */
export type TraceToWrite = {
  type: TraceType
  documentId?: string
  certificateId?: string
  versionId?: string
  details?: TraceDetails
}

/** `db` or the transaction the traced action runs in. */
export type TraceExecutor = Pick<typeof db, "insert">

/** The first X-Forwarded-For entry: Caddy replaces any client-sent value. */
export function clientIpFrom(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")
  if (!forwarded) return null
  const first = forwarded.split(",")[0]?.trim()
  if (!first) return null
  return first
}

/**
 * Writes a user's traces. Shared by the API's handlers and the account hooks
 * of Better Auth, so both write the same rows.
 */
export async function writeTraces(
  executor: TraceExecutor,
  userId: string,
  ipAddress: string | null,
  traces: TraceToWrite[]
) {
  if (traces.length === 0) return
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
