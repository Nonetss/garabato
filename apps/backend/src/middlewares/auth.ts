import { sessionHeaders } from "@nonete/api/shared/token-key"
import { auth } from "@nonete/auth"
import { createMiddleware } from "hono/factory"

export type AuthVariables = {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}

export const sessionMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // A browser token key reaches only its own procedures, which read it
    // from the headers themselves; it never resolves to a session.
    const session = await auth.api.getSession({
      headers: await sessionHeaders(c.req.raw.headers),
    })
    c.set("user", session?.user ?? null)
    c.set("session", session?.session ?? null)
    await next()
  }
)

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const user = c.get("user")
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    await next()
  }
)

export const requireAdmin = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const user = c.get("user")
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403)
    }
    await next()
  }
)
