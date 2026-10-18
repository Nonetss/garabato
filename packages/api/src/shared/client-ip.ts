import { clientIpFrom } from "@nonete/db/trace-writer"

import type { Context } from "#context"

/** The first X-Forwarded-For entry: Caddy replaces any client-sent value. */
export function clientIp(context: Context) {
  return clientIpFrom(context.headers)
}
