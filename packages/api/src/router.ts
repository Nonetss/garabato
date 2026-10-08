import type { ClientContext, RouterClient } from "@orpc/server"

import { appRouter as v1Router } from "#v1/router"

export const appRouter = {
  v1: v1Router,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
/** `AppRouterClient` whose calls also take the caller's client context. */
export type AppRouterContextClient<TClientContext extends ClientContext> =
  RouterClient<typeof appRouter, TClientContext>
