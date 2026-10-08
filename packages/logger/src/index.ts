import { env } from "@nonete/env/server"
import type { Logger } from "pino"
import { createLogger } from "#factory"

export { type CreateLoggerOptions, createLogger, type LogLevel } from "#factory"

export const logger: Logger = createLogger({
  service: "better-backend",
  level: env.LOG_LEVEL,
  production: env.NODE_ENV === "production",
  lokiUrl: env.LOKI_URL,
})

export const child = (bindings: Record<string, unknown>): Logger =>
  logger.child(bindings)
