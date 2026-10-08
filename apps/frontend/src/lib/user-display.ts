/**
 * Display name for a Better Auth `User` or any object that exposes `name` and
 * `email`. Falls back to the email local-part, then to `"Usuario"` so callers
 * never have to guard the empty-string case.
 *
 * The `User` type from Better Auth marks `name` and `email` as `string |
 * undefined` at runtime; callers shouldn't have to repeat the same null-coalesce
 * dance.
 */
export function userDisplayName(user: {
  name?: string | null | undefined
  email?: string | null | undefined
}): string {
  const name = user.name?.trim()
  if (name) return name

  const email = user.email
  if (typeof email === "string") {
    const local = email.split("@")[0]
    if (local) return local
  }

  return "Usuario"
}
