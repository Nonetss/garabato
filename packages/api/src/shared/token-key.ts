import { auth } from "@nonete/auth"
import { db } from "@nonete/db"

import { errors } from "#errors"

/**
 * The permission that makes a Better Auth API key a token key: the
 * credential the browser module uses. A token key reaches only the browser
 * token procedures and never resolves to a session.
 */
export const TOKEN_KEY_PERMISSIONS = { certificateToken: ["use"] }

/** The header the browser module sends its token key in. */
export const TOKEN_KEY_HEADER = "x-api-key"

/** Who is calling through a token key. */
export type TokenCaller = {
  userId: string
  keyId: string
  keyName: string
}

export const TWO_FACTOR_REQUIRED_MESSAGE =
  "Activa la verificación en dos pasos en tu perfil para usar tus certificados desde el navegador"

/** Whether an API key's permissions make it a token key. */
export function hasTokenPermission(
  permissions: Record<string, string[]> | null | undefined
) {
  if (!permissions) return false
  const actions = permissions.certificateToken
  if (!actions) return false
  return TOKEN_KEY_PERMISSIONS.certificateToken.every((action) =>
    actions.includes(action)
  )
}

/**
 * The key's record when the value is a valid, enabled token key; null for an
 * unknown key or an ordinary API key. Verified without asking Better Auth
 * for the permission, which would log every ordinary key as a failure.
 */
export async function verifyTokenKey(key: string) {
  const result = await auth.api.verifyApiKey({ body: { key } })
  if (!result.valid || !result.key) return null
  if (!hasTokenPermission(result.key.permissions)) return null
  return result.key
}

/**
 * Whether the request carries a token key. Such a request must not resolve
 * to a session nor reach Better Auth's endpoints.
 */
export async function carriesTokenKey(headers: Headers) {
  const value = headers.get(TOKEN_KEY_HEADER)
  if (!value) return false
  return (await verifyTokenKey(value)) !== null
}

// Whether Better Auth may turn the key into a session: a valid key that is
// not a token key.
async function opensSession(key: string) {
  const result = await auth.api.verifyApiKey({ body: { key } })
  if (!result.valid || !result.key) return false
  return !hasTokenPermission(result.key.permissions)
}

/**
 * The headers to resolve the session from. A token key never becomes a
 * session, and an unknown, revoked or expired key is left out too: Better
 * Auth's session lookup throws on one instead of answering "no session",
 * which would turn the request into a 500 rather than a 401.
 */
export async function sessionHeaders(headers: Headers) {
  const value = headers.get(TOKEN_KEY_HEADER)
  if (!value || (await opensSession(value))) return headers
  const withoutKey = new Headers(headers)
  withoutKey.delete(TOKEN_KEY_HEADER)
  return withoutKey
}

function isBanned(owner: { banned: boolean | null; banExpires: Date | null }) {
  if (!owner.banned) return false
  if (owner.banExpires === null) return true
  return owner.banExpires.getTime() > Date.now()
}

/**
 * Resolves the token key in the request headers to its owner. `UNAUTHORIZED`
 * without a valid token key or for a banned owner; `FORBIDDEN` when the owner
 * has two-factor authentication off, since the TOTP code is the token's PIN.
 */
export async function resolveTokenCaller(
  headers: Headers
): Promise<TokenCaller> {
  const value = headers.get(TOKEN_KEY_HEADER)
  if (!value) throw errors.UNAUTHORIZED()
  const key = await verifyTokenKey(value)
  if (!key) throw errors.UNAUTHORIZED()
  const owner = await db.query.user.findFirst({
    where: { id: key.referenceId },
  })
  if (!owner || isBanned(owner)) throw errors.UNAUTHORIZED()
  if (!owner.twoFactorEnabled) {
    throw errors.FORBIDDEN({ message: TWO_FACTOR_REQUIRED_MESSAGE })
  }
  return { userId: owner.id, keyId: key.id, keyName: key.name ?? "" }
}
