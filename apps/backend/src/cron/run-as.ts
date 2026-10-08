import { db } from "@nonete/db"

export type DeclaredJobsRunAs = { userId: string; role: string | null }

/**
 * The user code-declared cron jobs run as: the account the seed creates from
 * `ADMIN_EMAIL`. Null when no email is configured or no user has it.
 */
export async function resolveDeclaredJobsRunAs(
  email: string | undefined
): Promise<DeclaredJobsRunAs | null> {
  if (!email) return null

  const row = await db.query.user.findFirst({
    where: { email },
    columns: { id: true, role: true },
  })

  return row ? { userId: row.id, role: row.role } : null
}
