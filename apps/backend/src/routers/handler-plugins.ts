import type { Context } from "@nonete/api/context"
import { logger } from "@nonete/logger"
import { PinoHandlerPlugin } from "@orpc/pino"
import { COMMON_ERROR_STATUS_MAP, ORPCError } from "@orpc/server"
import {
  PrototypePollutionProtectionHandlerPlugin,
  RequestLimitHandlerPlugin,
} from "@orpc/server/plugins"
import type { StandardHandlerRoutingInterceptorOptions } from "@orpc/server/standard"
import type { Level } from "pino"

/**
 * Largest request body the API accepts. The biggest legitimate inputs are a
 * 4000-character comment, 2000-character URLs and a PKCS#12 file (≤ 100 KiB).
 */
const MAX_REQUEST_BODY_BYTES = 1024 * 1024

/**
 * The limit of the routes in `UPLOAD_PROCEDURE_PATHS`: a 20 MiB PDF plus the
 * multipart envelope.
 */
export const MAX_UPLOAD_BODY_BYTES = 21 * 1024 * 1024

/**
 * Procedures, by path below the handler prefix, that receive large files and
 * are served by a handler built with `MAX_UPLOAD_BODY_BYTES`. Every other
 * procedure keeps the 1 MiB limit.
 */
const UPLOAD_PROCEDURE_PATHS = new Set(["/v1/document/upload"])

/** True when `path` (the full request path) calls an upload procedure. */
export function isUploadPath(path: string, prefix: string): boolean {
  if (!path.startsWith(prefix)) return false
  return UPLOAD_PROCEDURE_PATHS.has(path.slice(prefix.length))
}

/**
 * Bun.serve closes a connection that sends nothing for 10 s (its default
 * `idleTimeout`), and oRPC pings event streams only every 15 s by default, so
 * a quiet stream (a cron run subscription) would be
 * cut. Pass as `toFetchResponse` to every handler that serves streams.
 */
export const eventStreamResponseOptions = {
  eventStream: { keepAlive: { enabled: true, interval: 5_000 } },
}

/**
 * The plugin's default only logs `INTERNAL_SERVER_ERROR` at `error` among
 * `ORPCError`s; upstream failures (`BAD_GATEWAY`, `SERVICE_UNAVAILABLE`,
 * `GATEWAY_TIMEOUT`) are just as much our problem, so every 5xx is.
 */
function procedureErrorLevel(error: unknown, level: Level): Level {
  if (error instanceof ORPCError && isServerErrorCode(error.code)) {
    return "error"
  }
  return level
}

/** HTTP status the handlers answer with for each error code. */
const errorStatusByCode = new Map<string, number>(
  Object.entries(COMMON_ERROR_STATUS_MAP)
)

/** Codes outside the map are answered with 500, so they count as 5xx. */
function isServerErrorCode(code: string): boolean {
  const status = errorStatusByCode.get(code)
  if (status === undefined) return true
  return status >= 500
}

/**
 * Reuses the id `requestLogger` assigned, so oRPC's `req.id` matches the
 * `requestId` on the request's other lines. Every HTTP-built context has one.
 */
function requestIdOf({
  context,
}: StandardHandlerRoutingInterceptorOptions<Context>): string {
  if (context.requestId !== undefined) return context.requestId
  return crypto.randomUUID()
}

/**
 * Logs each procedure error once, at a level matching its cause: `warn` for
 * deliberate 4xx rejections, `error` for 5xx and unexpected exceptions,
 * `info` for aborts. Lifecycle logging stays off: `requestLogger` already
 * logs every request.
 */
export function loggingPlugin() {
  return new PinoHandlerPlugin<Context>({
    logger,
    generateRequestId: requestIdOf,
    procedureErrorLevel,
  })
}

/**
 * Rejects bodies over `maxBodySize` (413) and inputs carrying `__proto__` or
 * `constructor.prototype` (400) before a procedure runs. Zod already drops
 * unknown keys, but not inside `z.record(...)` or `.passthrough()` inputs.
 */
export function hardeningPlugins(maxBodySize = MAX_REQUEST_BODY_BYTES) {
  return [
    new RequestLimitHandlerPlugin<Context>({ maxBodySize }),
    new PrototypePollutionProtectionHandlerPlugin<Context>(),
  ]
}
