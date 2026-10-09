import { env } from "@nonete/env/server"
import { eq } from "drizzle-orm"

import { db } from "#index"
import * as schema from "#schema/auth"

export type SeedAdminResult =
  | { created: false; reason: "missing-env" }
  | { created: false; reason: "already-exists"; email: string }
  | { created: true; email: string }

export type AuthLike = {
  api: {
    createUser: (args: {
      body: { email: string; password: string; name: string; role: "admin" }
    }) => Promise<unknown>
  }
}

export async function seedAdmin(auth: AuthLike): Promise<SeedAdminResult> {
  const email = env.ADMIN_EMAIL
  const password = env.ADMIN_PASSWORD
  const name = env.ADMIN_NAME ?? "Admin"

  if (!email || !password) {
    return { created: false, reason: "missing-env" }
  }

  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)

  if (existing.length > 0) {
    return { created: false, reason: "already-exists", email }
  }

  // The admin plugin's `createUser`, called server-side without headers,
  // rather than the public sign-up, which `DISABLE_SIGN_UP` closes.
  await auth.api.createUser({
    body: { email, password, name, role: "admin" },
  })

  return { created: true, email }
}
