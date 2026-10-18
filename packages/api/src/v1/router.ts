import type { RouterClient } from "@orpc/server"

import { apiKeyRouter } from "#v1/api-key/router"
import { authConfigRouter } from "#v1/auth-config/router"
import { certificateRouter } from "#v1/certificate/router"
import { certificateTokenRouter } from "#v1/certificate-token/router"
import { commentRouter } from "#v1/comment/router"
import { cronRouter } from "#v1/cron/router"
import { documentRouter } from "#v1/document/router"
import { documentFolderRouter } from "#v1/document-folder/router"
import { documentTagRouter } from "#v1/document-tag/router"
import { entityIconRouter } from "#v1/entity-icon/router"
import { healthRouter } from "#v1/health/router"
import { logsRouter } from "#v1/logs/router"
import { organizationRouter } from "#v1/organization/router"
import { pluginsRouter } from "#v1/plugins/router"
import { privateRouter } from "#v1/private/router"
import { releaseRouter } from "#v1/release/router"
import { sessionHistoryRouter } from "#v1/session-history/router"
import { traceRouter } from "#v1/trace/router"

export const appRouter = {
  authConfig: authConfigRouter,
  health: healthRouter,
  apiKey: apiKeyRouter,
  comment: commentRouter,
  certificate: certificateRouter,
  certificateToken: certificateTokenRouter,
  document: documentRouter,
  documentFolder: documentFolderRouter,
  documentTag: documentTagRouter,
  entityIcon: entityIconRouter,
  private: privateRouter,
  organization: organizationRouter,
  plugins: pluginsRouter,
  release: releaseRouter,
  cron: cronRouter,
  sessionHistory: sessionHistoryRouter,
  trace: traceRouter,
  logs: logsRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
