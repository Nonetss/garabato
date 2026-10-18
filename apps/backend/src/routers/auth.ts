import { carriesTokenKey } from "@nonete/api/shared/token-key"
import { auth } from "@nonete/auth"
import { Hono } from "hono"

const router = new Hono()

router.on(["POST", "GET"], "/api/auth/*", async (c) => {
  // Better Auth would turn a browser token key into a session; token keys
  // only reach the browser token procedures.
  if (await carriesTokenKey(c.req.raw.headers)) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  return auth.handler(c.req.raw)
})

export default router
