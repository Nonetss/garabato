import { env } from "@nonete/env/server"
import { drizzle } from "drizzle-orm/node-postgres"

import { relations } from "#relations"

export function createDb() {
  return drizzle(env.DATABASE_URL, { relations })
}

export const db = createDb()

let closing: Promise<void> | undefined

/**
 * Ends the shared pool. Safe to call more than once: `pg` rejects a second
 * `end()` on the same pool, so every call shares the first one's promise.
 */
export function closeDb(): Promise<void> {
  closing ??= db.$client.end()
  return closing
}
