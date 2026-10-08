export interface LokiStreamOptions {
  /** Loki base URL, e.g. `http://loki:3100`. */
  host: string
  /** Static, low-cardinality Loki stream labels (just `service`). */
  labels: Record<string, string>
  intervalMs?: number
  maxBatchSize?: number
}

/**
 * A minimal pino destination (`{ write(line) }`) that batches lines and
 * pushes them to Loki's HTTP push API on a timer.
 *
 * This intentionally does not depend on the `pino-loki` package: that
 * package's documented, supported usage is `pino.transport()`, which
 * resolves its target module by name from a worker thread at runtime.
 * Both `apps/backend` (tsdown) and `apps/frontend` (Vite) bundle every
 * dependency into a single file with no `node_modules` in the runtime
 * image, so nothing would be left on disk for that worker to resolve. A
 * plain synchronous stream — built from statically imported code, writing
 * with `fetch` — has no such runtime module resolution and survives being
 * bundled either way.
 */
export function createLokiStream({
  host,
  labels,
  intervalMs = 5000,
  maxBatchSize = 1000,
}: LokiStreamOptions): { write(line: string): void } {
  const pushUrl = new URL("/loki/api/v1/push", host)
  let buffer: [string, string][] = []

  const flush = () => {
    if (buffer.length === 0) return
    const values = buffer
    buffer = []
    fetch(pushUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ streams: [{ stream: labels, values }] }),
    }).catch(() => {
      // A Loki push failure must never surface anywhere else — logging
      // can't be allowed to break the app it's instrumenting.
    })
  }

  const timer = setInterval(flush, intervalMs)
  // Never keep the process alive just to flush logs.
  timer.unref?.()

  return {
    write(line: string) {
      buffer.push([String(Date.now() * 1_000_000), line.trimEnd()])
      if (buffer.length >= maxBatchSize) flush()
    },
  }
}
