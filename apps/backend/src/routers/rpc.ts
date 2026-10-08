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
  isUploadPath,
  loggingPlugin,
  MAX_UPLOAD_BODY_BYTES,
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
function createHandler(maxBodySize?: number) {
  return new RPCHandler(appRouter, {
    allowMethods: (method, procedure) => {
      if (method === "QUERY") return isReadProcedure(procedure)
      return RPC_DEFAULT_ALLOW_METHODS.includes(method)
    },
    plugins: [loggingPlugin(), ...hardeningPlugins(maxBodySize)],
    toFetchResponse: eventStreamResponseOptions,
  })
}

// The oRPC body limit is one number per handler, so upload procedures get
// their own handler with the larger limit; both answer 413 the same way.
const handler = createHandler()
const uploadHandler = createHandler(MAX_UPLOAD_BODY_BYTES)

function handlerFor(path: string) {
  if (isUploadPath(path, "/rpc")) return uploadHandler
  return handler
}

const router = new Hono()

router.use("/rpc/*", async (c, next) => {
  const context = await createContext({
    context: c,
    request: c.get("requestScope"),
  })
  const result = await handlerFor(c.req.path).handle(c.req.raw, {
    prefix: "/rpc",
    context,
  })
  if (result.matched)
    return c.newResponse(result.response.body, result.response)
  await next()
})

export default router
