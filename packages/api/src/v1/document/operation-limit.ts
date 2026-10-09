import { errors } from "#errors"
import { o, protectedProcedure } from "#index"

/** Heavy document operations one user may run at the same time. */
export const MAX_CONCURRENT_OPERATIONS = 2
/** Heavy document operations one user may start per window. */
export const MAX_OPERATIONS_PER_WINDOW = 30
export const OPERATION_WINDOW_MS = 60_000

const TOO_MANY_MESSAGE =
  "Tienes demasiadas operaciones con documentos en curso; espera un momento y vuelve a intentarlo"

type UserUsage = { running: number; starts: number[] }

export type OperationLimiter = {
  /** A release function when `userId` may start one more, else `null`. */
  tryAcquire: (userId: string) => (() => void) | null
  /** Users with any running operation or start inside the window. */
  trackedUsers: () => number
}

/**
 * Per-user concurrency and sliding-window limit, held in memory: the backend
 * runs as a single instance (like the cron scheduler). A refused call is not
 * counted, and an idle user's entry is dropped so the map stays bounded.
 */
export function createOperationLimiter({
  maxConcurrent,
  maxStarts,
  windowMs,
  now = Date.now,
}: {
  maxConcurrent: number
  maxStarts: number
  windowMs: number
  now?: () => number
}): OperationLimiter {
  const usage = new Map<string, UserUsage>()

  function pruned(userId: string) {
    const entry = usage.get(userId)
    if (!entry) return undefined
    const cutoff = now() - windowMs
    entry.starts = entry.starts.filter((start) => start > cutoff)
    if (entry.running === 0 && entry.starts.length === 0) {
      usage.delete(userId)
      return undefined
    }
    return entry
  }

  function usageOf(userId: string): UserUsage {
    const entry = pruned(userId)
    if (entry) return entry
    return { running: 0, starts: [] }
  }

  function release(userId: string) {
    const entry = usage.get(userId)
    if (!entry) return
    entry.running = Math.max(0, entry.running - 1)
    pruned(userId)
  }

  return {
    tryAcquire: (userId) => {
      const entry = usageOf(userId)
      if (entry.running >= maxConcurrent) return null
      if (entry.starts.length >= maxStarts) return null
      entry.running += 1
      entry.starts.push(now())
      usage.set(userId, entry)
      let released = false
      return () => {
        if (released) return
        released = true
        release(userId)
      }
    },
    trackedUsers: () => {
      for (const userId of [...usage.keys()]) pruned(userId)
      return usage.size
    },
  }
}

const documentOperations = createOperationLimiter({
  maxConcurrent: MAX_CONCURRENT_OPERATIONS,
  maxStarts: MAX_OPERATIONS_PER_WINDOW,
  windowMs: OPERATION_WINDOW_MS,
})

/** Refuses with 429 before the procedure runs when the caller is over limit. */
export function operationLimit(limiter: OperationLimiter) {
  return o.middleware(async ({ context, next }) => {
    if (!context.user) throw errors.UNAUTHORIZED()
    const release = limiter.tryAcquire(context.user.id)
    if (!release) throw errors.TOO_MANY_REQUESTS({ message: TOO_MANY_MESSAGE })
    try {
      return await next()
    } finally {
      release()
    }
  })
}

/**
 * Builder of the procedures that hold whole PDFs in memory (upload, sign,
 * edit pages, merge, verify signatures): `protectedProcedure` plus the
 * shared per-user limit.
 */
export const heavyDocumentProcedure = protectedProcedure.use(
  operationLimit(documentOperations)
)
