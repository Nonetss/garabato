import {
  type TraceExecutor,
  type TraceToWrite,
  writeTraces,
} from "@nonete/db/trace-writer"

import type { Context } from "#context"
import { clientIp } from "#shared/client-ip"

/** One action to trace; the user, time and client IP are filled in. */
export type TraceInput = TraceToWrite

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
  await writeTraces(executor, userId, clientIp(context), traces)
}
