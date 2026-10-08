import type { AppRouterContextClient } from "@nonete/api/router"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import {
  createTanstackQueryUtils,
  TANSTACK_QUERY_OPERATION_CONTEXT_SYMBOL,
  type TanstackQueryOperationContext,
} from "@orpc/tanstack-query"

/**
 * Client context of every call. TanStack Query utils fill in the operation
 * type; a direct `.call()` that only reads passes `{ read: true }` itself.
 */
export type RpcClientContext = TanstackQueryOperationContext & {
  read?: boolean
}

/**
 * Reads go out as `QUERY` (safe and idempotent, input in the body) and
 * everything else as `POST`. The backend only accepts `QUERY` on procedures
 * declared `GET` or `QUERY`, so marking a write as a read fails loudly.
 */
function rpcMethod(context: RpcClientContext): "QUERY" | "POST" {
  if (context.read === true) return "QUERY"
  const operation = context[TANSTACK_QUERY_OPERATION_CONTEXT_SYMBOL]
  if (operation === undefined) return "POST"
  if (operation.type === "query" || operation.type === "infinite")
    return "QUERY"
  return "POST"
}

export const link = new RPCLink<RpcClientContext>({
  // No `origin`: the link requests the relative `/rpc/...` path when a call
  // is made, so it targets the current browser origin and never touches
  // `window` during SSR. Caddy (prod) / Vite (dev) proxy `/rpc` to the
  // backend, keeping every call same-origin and CORS-free.
  url: "/rpc",
  method: ({ context }) => rpcMethod(context),
  fetch: (url, init) =>
    globalThis.fetch(url, {
      ...init,
      credentials: "include",
    }),
})

/** Plain oRPC client for direct, imperative calls. */
export const client: AppRouterContextClient<RpcClientContext> =
  createORPCClient(link)

/**
 * TanStack Query utils generated from the oRPC router. Use in components via
 * `useHydratedQuery(orpc.someProcedure.queryOptions())` /
 * `useMutation(orpc.someProcedure.mutationOptions())`. A direct read inside a
 * custom `queryFn` passes `{ context: { read: true } }` to `.call()`.
 */
export const orpc = createTanstackQueryUtils(client)
