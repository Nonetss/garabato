/**
 * `true` when the given user has the Better Auth `admin` role.
 *
 * Better Auth's `User` type doesn't expose `role` — the admin plugin attaches
 * it at runtime — so most callers do `(user as { role?: string }).role ===
 * "admin"`. That spread of unsafe casts is what this helper replaces.
 *
 * Pass `null` or `undefined` for "not signed in". Pass any non-user object
 * (e.g. a server-side `Astro.locals.user` that may or may not have `role`)
 * and the helper safely returns `false` instead of throwing.
 */
export function isAdminUser(user: unknown): boolean {
  if (typeof user !== "object" || user === null) return false
  const role = (user as { role?: unknown }).role
  return role === "admin"
}
