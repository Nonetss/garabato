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
    signUpEmail: (args: {
      body: { email: string; password: string; name: string }
    }) => Promise<{ user: { id: string } }>
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

  const { user: created } = await auth.api.signUpEmail({
    body: { email, password, name },
  })

  await db
    .update(schema.user)
    .set({ role: "admin" })
    .where(eq(schema.user.id, created.id))

  return { created: true, email }
}
