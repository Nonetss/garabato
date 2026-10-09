import type { Context } from "#context"

/** The first X-Forwarded-For entry: Caddy replaces any client-sent value. */
export function clientIp(context: Context) {
  const forwarded = context.headers.get("x-forwarded-for")
  if (!forwarded) return null
  const first = forwarded.split(",")[0]?.trim()
  if (!first) return null
  return first
}
