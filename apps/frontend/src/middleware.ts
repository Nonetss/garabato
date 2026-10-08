import { defineMiddleware } from "astro:middleware"
import { splitSetCookieHeader } from "better-auth/cookies"
import { authServer } from "@/lib/auth-server"
import { logger } from "@/lib/logger"

const publicPaths = ["/login", "/signup"]
const publicExactPaths = new Set(["/logo.svg"])
const adminPaths = ["/admin"]

function matchesPathSegment(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

function matchesAnyPathSegment(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => matchesPathSegment(path, prefix))
}

// Browsers tag speculative loads (Astro's hover/viewport/tap prefetch,
// <link rel="prefetch">, speculation rules) with Sec-Purpose — legacy
// implementations use Purpose instead — so they're otherwise
// indistinguishable from a real navigation by path/method alone.
function isPrefetchRequest(headers: Headers): boolean {
  const secPurpose = headers.get("sec-purpose")?.toLowerCase() ?? ""
  const purpose = headers.get("purpose")?.toLowerCase() ?? ""
  return secPurpose.includes("prefetch") || purpose.includes("prefetch")
}

// Page views follow browser navigation semantics rather than URL spelling:
// dynamic page parameters may contain dots, while API routes may not. Astro's
// client router fetches HTML without Sec-Fetch-Dest, so Accept is the fallback.
function isPageView(method: string, headers: Headers): boolean {
  if (method !== "GET" || isPrefetchRequest(headers)) return false

  const destination = headers.get("sec-fetch-dest")?.toLowerCase()
  if (destination) return destination === "document"

  return headers.get("accept")?.toLowerCase().includes("text/html") ?? false
}

function appendRefreshedCookies(
  response: Response,
  refreshedCookies: readonly string[]
): Response {
  for (const cookie of refreshedCookies) {
    response.headers.append("set-cookie", cookie)
  }
  return response
}

function logPageView({
  user,
  method,
  path,
  status,
  latencyMs,
}: {
  user: { id: string; email: string }
  method: string
  path: string
  status: number
  latencyMs: number
}) {
  const fields = {
    type: "page_view",
    method,
    path,
    status,
    latencyMs,
    userId: user.id,
    email: user.email,
  }
  if (status >= 500) {
    logger.error(fields, "page view")
  } else if (status >= 400) {
    logger.warn(fields, "page view")
  } else {
    logger.info(fields, "page view")
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const start = performance.now()
  const path = context.url.pathname
  const method = context.request.method

  context.locals.session = null
  context.locals.user = null

  if (publicExactPaths.has(path) || matchesAnyPathSegment(path, publicPaths)) {
    return next()
  }

  let refreshedCookies: string[] = []

  const sessionResult = await authServer.getSession({
    fetchOptions: {
      headers: Object.fromEntries(context.request.headers.entries()),
      onResponse: (ctx) => {
        refreshedCookies = splitSetCookieHeader(
          ctx.response.headers.get("set-cookie") ?? ""
        )
      },
    },
  })

  if (sessionResult.error) {
    logger.error(
      {
        type: "auth_service_error",
        path,
        status: sessionResult.error.status,
        message: sessionResult.error.message,
      },
      "session resolution failed"
    )
    return appendRefreshedCookies(
      new Response("Service Unavailable", {
        status: 503,
        headers: { "cache-control": "no-store" },
      }),
      refreshedCookies
    )
  }

  if (sessionResult.data === null) {
    return appendRefreshedCookies(context.redirect("/login"), refreshedCookies)
  }

  const { user, session } = sessionResult.data

  context.locals.session = session
  context.locals.user = user

  if (matchesAnyPathSegment(path, adminPaths)) {
    if (user.role !== "admin") {
      return appendRefreshedCookies(context.redirect("/"), refreshedCookies)
    }
  }

  const trackPageView = isPageView(method, context.request.headers)

  const response = await next()

  if (trackPageView) {
    const latencyMs = Number((performance.now() - start).toFixed(2))
    logPageView({ user, method, path, status: response.status, latencyMs })
  }

  return appendRefreshedCookies(response, refreshedCookies)
})
