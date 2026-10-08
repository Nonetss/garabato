import { ORPCError } from "@orpc/client"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { client, orpc } from "@/lib/orpc"

const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000

/** Errors a retry can't fix: the job is gone or the session is. */
const PERMANENT_ERROR_CODES = new Set([
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
])

function reconnectDelay(failures: number): number {
  return Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** failures,
    RECONNECT_MAX_DELAY_MS
  )
}

function isPermanentError(error: unknown): boolean {
  return error instanceof ORPCError && PERMANENT_ERROR_CODES.has(error.code)
}

/** Resolves after `ms`, or right away once `signal` aborts. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })
}

/**
 * Keeps the job (lastRunAt/nextRunAt), the run pulse and the run history live
 * while the detail page is open: `v1.cron.watchRuns` pushes an event whenever
 * one of the job's runs starts, finishes or is skipped, and each event
 * refetches them. Nothing polls.
 *
 * The stream sends `subscribed` on every (re)connection and events are not
 * replayed, so that one refetches too, covering whatever changed before the
 * subscription opened or while it was down. A dropped stream reconnects with
 * exponential backoff.
 */
export function useCronRunEvents(jobId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: orpc.v1.cron.get.queryKey({ input: { id: jobId } }),
      })
      // Partial input: matches the pulse and every filtered history list.
      void queryClient.invalidateQueries({
        queryKey: orpc.v1.cron.listRuns.key({ input: { jobId } }),
      })
    }

    const listen = async () => {
      let failures = 0
      while (!signal.aborted) {
        try {
          const events = await client.v1.cron.watchRuns(
            { jobId },
            { signal, context: { read: true } }
          )
          for await (const event of events) {
            if (event.type === "subscribed") failures = 0
            refresh()
          }
        } catch (error) {
          if (signal.aborted || isPermanentError(error)) return
        }
        await wait(reconnectDelay(failures), signal)
        failures += 1
      }
    }

    void listen()
    return () => controller.abort()
  }, [jobId, queryClient])
}
