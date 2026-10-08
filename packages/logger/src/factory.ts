import pino, { type Logger, type LoggerOptions, type StreamEntry } from "pino"
import pretty from "pino-pretty"
import { createLokiStream } from "#loki-stream"

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace"

export interface CreateLoggerOptions {
  /** Base `service` label attached to every line and, when `lokiUrl` is
   * set, to the Loki stream. Keep this the only static label — anything
   * higher-cardinality (userId, path, ...) belongs in the log payload, not
   * a label, or Loki ends up with one stream per value. */
  service: string
  level: LogLevel
  production: boolean
  /** Loki push endpoint (e.g. `http://loki:3100`). Omit to skip shipping
   * to Loki entirely — console/stdout output is unaffected either way. */
  lokiUrl?: string
}

/**
 * Env-agnostic pino factory shared by every service that logs (backend,
 * frontend, ...). Callers pass their own config instead of this module
 * reading it, so it carries no dependency on any particular env schema.
 *
 * Builds plain synchronous streams (`pino.multistream`), never
 * `pino.transport()` — see `#loki-stream` for why: both apps that use this
 * bundle every dependency into one file with no `node_modules` in the
 * runtime image, which a transport's worker-thread module resolution
 * can't survive.
 */
export function createLogger({
  service,
  level,
  production,
  lokiUrl,
}: CreateLoggerOptions): Logger {
  const options: LoggerOptions = {
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
  }

  const streams: StreamEntry[] = [
    {
      level,
      stream: production
        ? process.stdout
        : pretty({ colorize: true, translateTime: "HH:MM:ss.l" }),
    },
  ]

  if (lokiUrl) {
    streams.push({
      level,
      stream: createLokiStream({ host: lokiUrl, labels: { service } }),
    })
  }

  return pino(options, pino.multistream(streams))
}
