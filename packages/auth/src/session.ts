import { auth } from "#auth/index"

type SessionUser = typeof auth.$Infer.Session.user
type SessionRow = typeof auth.$Infer.Session.session

export type UserSession = {
  user: SessionUser
  session: SessionRow
  /** Request headers carrying the signed session cookie for this session. */
  headers: Headers
  /** Deletes the underlying session row. */
  revoke: () => Promise<void>
}

const signingAlgorithm = { name: "HMAC", hash: "SHA-256" } as const

/**
 * Signs a cookie value the way better-call does (`<value>.<base64 hmac>`,
 * URI-encoded) so better-auth's `getSignedCookie` accepts it on the way back in.
 */
async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    signingAlgorithm,
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    signingAlgorithm.name,
    key,
    new TextEncoder().encode(value)
  )
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return encodeURIComponent(`${value}.${encoded}`)
}

/**
 * Creates a real Better Auth session for `userId` and returns it together with
 * headers carrying its session cookie, so anything called with those headers
 * (`auth.api.*`, oRPC procedures) runs as that user.
 *
 * There is no `auth.api.createSession` endpoint — session creation lives only on
 * the internal adapter, hence `auth.$context`.
 *
 * Callers are responsible for `revoke()`ing the session when they are done:
 * these are server-side sessions nobody will ever sign out of.
 */
export async function createUserSession(userId: string): Promise<UserSession> {
  const context = await auth.$context

  const user = await context.internalAdapter.findUserById(userId)
  if (!user) {
    throw new Error(`Cannot create a session: user not found (${userId})`)
  }
  if ("banned" in user && user.banned === true) {
    throw new Error(`Cannot create a session: user is banned (${userId})`)
  }

  const session = await context.internalAdapter.createSession(userId)

  const headers = new Headers()
  headers.set(
    "cookie",
    `${context.authCookies.sessionToken.name}=${await signCookieValue(
      session.token,
      context.secret
    )}`
  )

  return {
    user: user as SessionUser,
    session: session as SessionRow,
    headers,
    revoke: async () => {
      await context.internalAdapter.deleteSession(session.token)
    },
  }
}
