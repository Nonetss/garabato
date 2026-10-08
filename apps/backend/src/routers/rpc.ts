import { createContext } from "@nonete/api/context"
import { appRouter } from "@nonete/api/router"
import { getOpenAPIMeta } from "@orpc/openapi"
import type { AnyProcedure } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { RPC_DEFAULT_ALLOW_METHODS } from "@orpc/server/standard"
import { Hono } from "hono"
import {
  eventStreamResponseOptions,
  hardeningPlugins,
  loggingPlugin,
} from "@/routers/handler-plugins"

/** True for procedures declared `GET` or `QUERY`: they never write. */
function isReadProcedure(procedure: AnyProcedure): boolean {
  const method = getOpenAPIMeta(procedure)?.method
  return method === "GET" || method === "QUERY"
}

// No CSRF plugin: the RPC handler accepts POST/PUT/PATCH/DELETE (the oRPC
// default) plus QUERY, and never GET. The session cookie is SameSite=Lax, so
// browsers never attach it to a cross-site unsafe method, and QUERY is not
// CORS-safelisted, so a cross-site page can't send it without passing the
// preflight. QUERY is still limited to read procedures: it is a safe method
// and must never run one that writes.
const handler = new RPCHandler(appRouter, {
  allowMethods: (method, procedure) => {
    if (method === "QUERY") return isReadProcedure(procedure)
    return RPC_DEFAULT_ALLOW_METHODS.includes(method)
  },
  plugins: [loggingPlugin(), ...hardeningPlugins()],
  toFetchResponse: eventStreamResponseOptions,
})

const router = new Hono()

router.use("/rpc/*", async (c, next) => {
  const context = await createContext({
    context: c,
    request: c.get("requestScope"),
  })
  const result = await handler.handle(c.req.raw, { prefix: "/rpc", context })
  if (result.matched)
    return c.newResponse(result.response.body, result.response)
  await next()
})

export default router
