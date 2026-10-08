import { LOKI_URL } from "astro:env/server"
import { createLogger } from "@nonete/logger/factory"

export const logger = createLogger({
  service: "stack-frontend",
  level: "info",
  production: import.meta.env.PROD,
  lokiUrl: LOKI_URL,
})
