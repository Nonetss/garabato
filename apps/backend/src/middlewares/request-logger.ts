import type { RequestScope } from "@nonete/api/context"
import { child, logger } from "@nonete/logger"
import { createMiddleware } from "hono/factory"
import type { AuthVariables } from "@/middlewares/auth"

const start = Symbol("requestStart")

declare module "hono" {
  interface ContextVariableMap {
    [start]?: number
    /** Set by `requestLogger` on every request, before any route runs. */
    requestScope: RequestScope
  }
}

// Only requests to actual oRPC endpoints count as activity-log "api_call"
// entries — Better Auth's own high-frequency routes, the docs routes, and
// the logs query itself (would recurse into the activity feed) are
// excluded, per openspec/changes/add-activity-log/design.md.
const excludedFromActivityLog = [
  "/api/auth",
  "/scalar",
  "/openapi.json",
  "/rpc/v1/logs",
  "/api/v1/logs",
]

function isActivityLoggedPath(path: string): boolean {
  if (excludedFromActivityLog.some((prefix) => path.startsWith(prefix))) {
    return false
  }
  return path.startsWith("/rpc") || path.startsWith("/api")
}

export const requestLogger = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // Generated here, never taken from an inbound `x-request-id`, so callers
    // can't choose the ids that land in our logs. oRPC reuses this logger
    // (see `createContext`), so its error lines carry the same id.
    const requestId = crypto.randomUUID()
    const reqLog = child({
      requestId,
      method: c.req.method,
      path: c.req.path,
    })
    c.set("requestScope", { id: requestId, logger: reqLog })
    c.set(start, performance.now())
    reqLog.info("request received")
    await next()
    const status = c.res.status
    const latencyMs =
      typeof c.get(start) === "number"
        ? Number((performance.now() - (c.get(start) as number)).toFixed(2))
        : undefined
    // Set by sessionMiddleware during the `next()` call above, even though
    // this middleware runs before it in the chain — both operate on the
    // same request-scoped context.
    const user = c.get("user")
    // Activity-log entries are only attributable to a signed-in user and
    // only cover actual endpoint calls, never anonymous or internal
    // traffic — see the "Unauthenticated traffic is not logged" and
    // "Internal and documentation routes are excluded" requirements in
    // openspec/specs/activity-log/spec.md.
    const isActivity = Boolean(user) && isActivityLoggedPath(c.req.path)
    const fields: Record<string, unknown> = {
      status,
      latencyMs,
      userId: user?.id,
      email: user?.email,
      ...(isActivity ? { type: "api_call" } : {}),
    }
    if (status >= 500) {
      reqLog.error(fields, "request completed")
    } else if (status >= 400) {
      reqLog.warn(fields, "request completed")
    } else {
      reqLog.info(fields, "request completed")
    }
  }
)

export { logger }
