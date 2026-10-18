import type { TraceToWrite } from "@nonete/db/trace-writer"

/** The user as the request found them, before it ran. */
export type AccountState = {
  userId: string
  name: string
  twoFactorEnabled: boolean
}

/** What a finished Better Auth request tells about the account. */
export type AccountEvent = {
  path: string
  /** The endpoint answered an error. */
  failed: boolean
  /** Better Auth's error code, such as `INVALID_EMAIL_OR_PASSWORD`. */
  errorCode: string | null
  /** The user of the session this request created, if any. */
  newSessionUserId: string | null
  /** The signed-in user before the request; null without a session. */
  before: AccountState | null
  /** The same user after the request, for paths that change them. */
  after: Pick<AccountState, "name" | "twoFactorEnabled"> | null
  /** The account a sign-in email belongs to (failed sign-ins only). */
  emailUserId: string | null
  /** The user a two-step sign-in is for, from its cookie (failed codes only). */
  twoFactorUserId: string | null
  userAgent: string | null
}

export type AccountTrace = { userId: string; trace: TraceToWrite }

/** Paths whose handling needs the signed-in user before the request. */
export const PATHS_NEEDING_BEFORE = new Set([
  "/sign-out",
  "/update-user",
  "/change-password",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/verify-otp",
  "/two-factor/disable",
])

const TWO_FACTOR_VERIFY_PATHS = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/verify-otp",
])

export function isSsoCallback(path: string) {
  return path.startsWith("/callback/") || path.startsWith("/oauth2/callback/")
}

function signInFailureReason(errorCode: string | null) {
  if (errorCode === "BANNED_USER") return "banned"
  if (errorCode === "INVALID_EMAIL_OR_PASSWORD") return "wrong-password"
  return null
}

function signedIn(
  userId: string,
  method: "password" | "sso",
  userAgent: string | null
): AccountTrace {
  return {
    userId,
    trace: { type: "account.signedIn", details: { method, userAgent } },
  }
}

/**
 * The traces a finished account request leaves. Only completed actions and
 * the listed security failures count; a failure nobody owns (an email no
 * account has) leaves none. Never a password or a code.
 */
export function accountTracesFor(event: AccountEvent): AccountTrace[] {
  const { path, failed, before } = event

  if (failed) {
    if (path === "/sign-in/email" && event.emailUserId) {
      const reason = signInFailureReason(event.errorCode)
      if (!reason) return []
      return [
        {
          userId: event.emailUserId,
          trace: { type: "account.signInFailed", details: { reason } },
        },
      ]
    }
    // A wrong code while signing in (no session yet); a wrong code while
    // enrolling is not a sign-in failure.
    if (TWO_FACTOR_VERIFY_PATHS.has(path) && !before && event.twoFactorUserId) {
      return [
        {
          userId: event.twoFactorUserId,
          trace: { type: "account.twoFactorFailed" },
        },
      ]
    }
    return []
  }

  if (isSsoCallback(path) && event.newSessionUserId) {
    return [signedIn(event.newSessionUserId, "sso", event.userAgent)]
  }
  if (path === "/sign-in/email" && event.newSessionUserId) {
    return [signedIn(event.newSessionUserId, "password", event.userAgent)]
  }
  if (TWO_FACTOR_VERIFY_PATHS.has(path)) {
    // Without a session the code completed a sign-in; with one, it can
    // complete the enrolment, which turns two-step verification on.
    if (!before && event.newSessionUserId) {
      return [signedIn(event.newSessionUserId, "password", event.userAgent)]
    }
    if (before && !before.twoFactorEnabled && event.after?.twoFactorEnabled) {
      return [
        { userId: before.userId, trace: { type: "account.twoFactorEnabled" } },
      ]
    }
    return []
  }

  if (!before) return []
  switch (path) {
    case "/sign-out":
      return [{ userId: before.userId, trace: { type: "account.signedOut" } }]
    case "/change-password":
      return [
        { userId: before.userId, trace: { type: "account.passwordChanged" } },
      ]
    case "/two-factor/disable":
      return [
        { userId: before.userId, trace: { type: "account.twoFactorDisabled" } },
      ]
    case "/update-user": {
      if (!event.after || event.after.name === before.name) return []
      return [
        {
          userId: before.userId,
          trace: {
            type: "account.nameChanged",
            details: { from: before.name, to: event.after.name },
          },
        },
      ]
    }
    default:
      return []
  }
}
