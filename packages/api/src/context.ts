import type { auth } from "@nonete/auth"
import {
  getLogger,
  LOGGER_CONTEXT_SYMBOL,
  type LoggerContext,
} from "@orpc/pino"
import type { Context as HonoContext } from "hono"
import type { Logger } from "pino"

/**
 * Id and logger the backend's request logger assigns to every HTTP request.
 * The logger already carries the id, so every line it writes can be joined
 * with the request's "request completed" entry.
 */
export type RequestScope = {
  id: string
  logger: Logger
}

export type CreateContextOptions = {
  context: HonoContext
  request: RequestScope
}

/**
 * Request context. `requestId` exists only on HTTP-built contexts. `cron` is
 * set only by the in-process scheduler; `createContext()` never populates it,
 * so HTTP-built contexts stay cron-free.
 *
 * The request logger is deliberately not part of this type: the builders'
 * middlewares spread the context, so a `unique symbol` key here would reach
 * every router's emitted declarations, where it can't be named. It travels at
 * runtime under `LOGGER_CONTEXT_SYMBOL` instead (see `HttpContext`) and is
 * read with `getRequestLogger`.
 */
export interface Context {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
  headers: Headers
  requestId?: string
  cron?: { jobId: string; jobName: string }
}

/** What `createContext` builds: a `Context` that also carries the logger. */
export type HttpContext = Context & LoggerContext

export async function createContext({
  context,
  request,
}: CreateContextOptions): Promise<HttpContext> {
  const user = (context.get("user") ?? null) as Context["user"]
  const session = (context.get("session") ?? null) as Context["session"]

  return {
    user,
    session,
    headers: context.req.raw.headers,
    requestId: request.id,
    // Read by `PinoHandlerPlugin` and by `getRequestLogger`.
    [LOGGER_CONTEXT_SYMBOL]: request.logger,
  }
}

/**
 * The logger of the HTTP request a procedure is serving, already bound to its
 * request id and procedure path. `undefined` outside HTTP (cron runs).
 */
export function getRequestLogger(context: Context): Logger | undefined {
  const withLogger: HttpContext = context
  return getLogger(withLogger)
}
