import type { Context } from "#context"
import { errors } from "#errors"

/** The signed-in caller's id; `UNAUTHORIZED` without a session. */
export function requireUserId(context: Context): string {
  if (!context.user) throw errors.UNAUTHORIZED()
  return context.user.id
}
