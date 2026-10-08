import type { Context } from "#context"

type User = NonNullable<Context["user"]>
type Session = NonNullable<Context["session"]>

const now = new Date("2026-01-01T00:00:00.000Z")

function user(role: string): User {
  return {
    id: `${role}-id`,
    name: `${role} name`,
    email: `${role}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now,
    role,
  } as User
}

function session(
  userId: string,
  activeOrganizationId: string | null = null
): Session {
  return {
    id: `${userId}-session`,
    userId,
    token: `${userId}-token`,
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
    activeOrganizationId,
  } as Session
}

function signedIn(role: string, activeOrganizationId?: string): Context {
  const signedInUser = user(role)
  return {
    user: signedInUser,
    session: session(signedInUser.id, activeOrganizationId),
    headers: new Headers({ cookie: `session=${signedInUser.id}` }),
  }
}

export function anonymousContext(): Context {
  return { user: null, session: null, headers: new Headers() }
}

export function userContext(activeOrganizationId?: string): Context {
  return signedIn("user", activeOrganizationId)
}

export function adminContext(): Context {
  return signedIn("admin")
}

/** What the in-process scheduler builds; never produced by HTTP requests. */
export function cronContext(base: Context = adminContext()): Context {
  return { ...base, cron: { jobId: "job-id", jobName: "job name" } }
}
