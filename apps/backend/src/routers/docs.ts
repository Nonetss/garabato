import { createContext } from "@nonete/api/context"
import { appRouter } from "@nonete/api/router"
import { SmartCoercionHandlerPlugin } from "@orpc/json-schema"
import { OpenAPIGenerator } from "@orpc/openapi"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins"
import { GetMethodCsrfProtectionHandlerPlugin } from "@orpc/server/plugins"
import { ZodToJsonSchemaConverter } from "@orpc/zod"
import { Hono } from "hono"
import { requireAdmin } from "@/middlewares/auth"
import {
  eventStreamResponseOptions,
  hardeningPlugins,
  isUploadPath,
  loggingPlugin,
  MAX_UPLOAD_BODY_BYTES,
} from "@/routers/handler-plugins"

// Relative on purpose: /scalar is served through the frontend's origin (Caddy
// in prod, Vite in dev), which also serves /logo.svg.
const docsHead = `<link rel="icon" href="/logo.svg" type="image/svg+xml">`

const generator = new OpenAPIGenerator({
  converters: [new ZodToJsonSchemaConverter()],
})

// Built on each docs request, as v1 did: only admins reach /scalar and
// /openapi.json, so caching the document isn't worth the extra state.
const generateSpec = () =>
  generator.generate(appRouter, {
    version: "3.2.0",
    base: {
      servers: [{ url: "/api" }],
      info: {
        title: "Garabato API",
        version: "1.0.0",
        summary:
          "Advanced base template for modern APIs — robust authentication with Better Auth, a scalable Hono and oRPC architecture, API key management, generated OpenAPI docs and Docker ready for production deployments. Built to get new projects off the ground in record time.",
        contact: {
          name: "Nonete",
          email: "amorenolopezbarajas@pm.me",
          url: "https://github.com/Nonetss",
        },
        description: "Garabato API description",
      },
      security: [{ ApiKey: [] }, { BearerAuth: [] }],
      components: {
        securitySchemes: {
          ApiKey: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description: "API key — pass your key in the x-api-key header",
          },
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            description: "Session token — pass your session token as Bearer",
          },
        },
      },
    },
  })

// Two handlers on purpose: the reference plugin serves `${prefix}/scalar` and
// `${prefix}/openapi.json` for whatever prefix the handler runs under, so a
// handler shared with /api would also answer /api/scalar and /api/openapi.json
// outside the requireAdmin gate below. The gate stays in Hono rather than the
// plugin's `allow`, which answers 404 instead of 401/403.
const docsHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferenceHandlerPlugin({
      provider: "scalar",
      docsPath: "/scalar",
      specPath: "/openapi.json",
      docsHead,
      spec: generateSpec,
    }),
    loggingPlugin(),
  ],
})

function createApiHandler(maxBodySize?: number) {
  return new OpenAPIHandler(appRouter, {
    plugins: [
      // /api is called both by browsers on the session cookie and by external
      // clients on an API key or bearer token. Unsafe methods are covered by the
      // SameSite=Lax session cookie; this rejects the one cross-site request a
      // browser still sends it on: a top-level GET navigation. Server-to-server
      // calls (API-key clients) carry no Fetch Metadata and pass.
      new GetMethodCsrfProtectionHandlerPlugin(),
      // Query and path values arrive as strings; coerce them to the type the
      // input schema declares (e.g. `limit` to a number) before validation.
      // /rpc doesn't need it: its serializer keeps the types.
      new SmartCoercionHandlerPlugin({
        converters: [new ZodToJsonSchemaConverter()],
      }),
      loggingPlugin(),
      ...hardeningPlugins(maxBodySize),
    ],
    toFetchResponse: eventStreamResponseOptions,
  })
}

// One handler per body limit (see the /rpc router): uploads get the larger one.
const apiHandler = createApiHandler()
const apiUploadHandler = createApiHandler(MAX_UPLOAD_BODY_BYTES)

function apiHandlerFor(path: string) {
  if (isUploadPath(path, "/api")) return apiUploadHandler
  return apiHandler
}

const router = new Hono()

const docsMiddleware: Parameters<typeof router.use>[1] = async (c, next) => {
  const context = await createContext({
    context: c,
    request: c.get("requestScope"),
  })
  const result = await docsHandler.handle(c.req.raw, {
    prefix: "/",
    context,
  })
  if (result.matched)
    return c.newResponse(result.response.body, result.response)
  await next()
}

router.use("/scalar", requireAdmin, docsMiddleware)
router.use("/scalar/*", requireAdmin, docsMiddleware)
router.use("/openapi.json", requireAdmin, docsMiddleware)

const apiMiddleware: Parameters<typeof router.use>[1] = async (c, next) => {
  const context = await createContext({
    context: c,
    request: c.get("requestScope"),
  })
  const result = await apiHandlerFor(c.req.path).handle(c.req.raw, {
    prefix: "/api",
    context,
  })
  if (result.matched)
    return c.newResponse(result.response.body, result.response)
  await next()
}

router.use("/api/*", apiMiddleware)

export default router
