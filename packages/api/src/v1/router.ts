import type { RouterClient } from "@orpc/server"

import { apiKeyRouter } from "#v1/api-key/router"
import { authConfigRouter } from "#v1/auth-config/router"
import { commentRouter } from "#v1/comment/router"
import { cronRouter } from "#v1/cron/router"
import { entityIconRouter } from "#v1/entity-icon/router"
import { healthRouter } from "#v1/health/router"
import { logsRouter } from "#v1/logs/router"
import { organizationRouter } from "#v1/organization/router"
import { pluginsRouter } from "#v1/plugins/router"
import { privateRouter } from "#v1/private/router"
import { sessionHistoryRouter } from "#v1/session-history/router"

export const appRouter = {
  authConfig: authConfigRouter,
  health: healthRouter,
  apiKey: apiKeyRouter,
  comment: commentRouter,
  entityIcon: entityIconRouter,
  private: privateRouter,
  organization: organizationRouter,
  plugins: pluginsRouter,
  cron: cronRouter,
  sessionHistory: sessionHistoryRouter,
  logs: logsRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
