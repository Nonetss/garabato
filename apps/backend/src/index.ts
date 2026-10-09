import { closeCronRunEvents } from "@nonete/api/v1/cron/events"
import { auth } from "@nonete/auth"
import { closeDb } from "@nonete/db"
import { seed } from "@nonete/db/seed"
import { env } from "@nonete/env/server"
import { logger } from "@nonete/logger"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { cronScheduler, startCron } from "@/cron"
import { type AuthVariables, sessionMiddleware } from "@/middlewares/auth"
import { requestLogger } from "@/middlewares/request-logger"
import authRouter from "@/routers/auth"
import docsRouter from "@/routers/docs"
import rpcRouter from "@/routers/rpc"

/**
 * HTTP requests still open after this are cut, so a long stream (e.g. a cron
 * run subscription) can't keep cron and the database pool from closing.
 */
const HTTP_DRAIN_TIMEOUT_MS = 5_000

/** Below Docker's default 10 s stop grace period, so we exit before a SIGKILL. */
const SHUTDOWN_TIMEOUT_MS = 8_000

/**
 * Largest body Bun reads on any route (`/api/auth/*` included) before
 * answering 413. Kept above `MAX_UPLOAD_BODY_BYTES` (21 MiB), so the oRPC
 * handlers' own limits keep answering first with the API error body.
 */
const MAX_SERVER_BODY_BYTES = 25 * 1024 * 1024

async function bootstrap() {
  await seed(auth)
  await startCron()
}

const app = new Hono<{ Variables: AuthVariables }>()

app.use(requestLogger)
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS", "DELETE", "PUT", "PATCH", "QUERY"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
    credentials: true,
  })
)
app.use("/*", sessionMiddleware)

app.route("/", authRouter)
app.route("/", rpcRouter)
app.route("/", docsRouter)

app.get("/", (c) => c.text("OK"))

// `bun --hot` re-executes this module's top level on every dependency
// change (e.g. a repo-wide `bun run format`), so a plain top-level call
// would re-run seed/cron on top of an already-running server and stack
// duplicate SIGINT/SIGTERM handlers, each racing to close clients and
// call process.exit — the mess of a shutdown that can force turbo to
// hard-kill the process and leave the terminal in a broken state.
// globalThis survives hot reloads (same JS realm), unlike module-level
// bindings, so it's the only place that can guard this.
declare global {
  var __backendBootstrapped: boolean | undefined
  var __backendServer: ReturnType<typeof Bun.serve> | undefined
}

// Served explicitly, not through `export default app`, so shutdown has a
// server to stop. This runs on every `--hot` reload to pick up the new
// `fetch`; the stable `id` makes Bun reload the running server in place
// instead of binding the port again. No `port`: Bun resolves it exactly as it
// did for the default export (PORT, else 3000).
globalThis.__backendServer = Bun.serve({
  id: "backend",
  fetch: app.fetch,
  maxRequestBodySize: MAX_SERVER_BODY_BYTES,
})

if (!globalThis.__backendBootstrapped) {
  globalThis.__backendBootstrapped = true
  bootstrap().catch((err) => {
    logger.error({ err }, "bootstrap failed")
    process.exit(1)
  })

  const stopHttpServer = async () => {
    const server = globalThis.__backendServer
    if (!server) return

    let drainTimer: ReturnType<typeof setTimeout> | undefined
    const drained = await Promise.race([
      server.stop().then(() => true),
      new Promise<false>((resolve) => {
        drainTimer = setTimeout(() => resolve(false), HTTP_DRAIN_TIMEOUT_MS)
      }),
    ])
    clearTimeout(drainTimer)

    if (!drained) {
      logger.warn(
        { drainTimeoutMs: HTTP_DRAIN_TIMEOUT_MS },
        "http drain timed out, closing open connections"
      )
      await server.stop(true)
    }
  }

  let shuttingDown = false

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      logger.info({ signal }, "shutdown already in progress")
      return
    }
    shuttingDown = true
    logger.info({ signal }, "shutting down")

    // Not unref'd on purpose: if a step hangs, this is what ends the process.
    setTimeout(() => {
      logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, "shutdown timed out")
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)

    let failed = false
    const step = async (name: string, run: () => unknown) => {
      try {
        await run()
      } catch (err) {
        failed = true
        logger.error({ err, step: name }, "shutdown step failed")
      }
    }

    // Run-event subscriptions never end on their own, so an open cron detail
    // page would hold the HTTP drain until its timeout. Ending them first lets
    // their responses finish; the clients reconnect to the next instance.
    await step("cron events", closeCronRunEvents)
    // HTTP next so no new request starts database work; the pool last,
    // because requests and cron can still query it until then.
    await step("http", stopHttpServer)
    await step("cron", () => cronScheduler.stop())
    await step("database", closeDb)

    logger.info({ signal, failed }, "shutdown complete")
    process.exit(failed ? 1 : 0)
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void shutdown(signal)
    })
  }
}
