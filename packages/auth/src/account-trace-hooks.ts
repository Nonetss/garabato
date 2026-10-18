import { db } from "@nonete/db"
import { clientIpFrom, writeTraces } from "@nonete/db/trace-writer"
import {
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api"
import {
  type AccountState,
  accountTracesFor,
  isSsoCallback,
  PATHS_NEEDING_BEFORE,
} from "#auth/account-traces"

// The two-step plugin's cookie: it points at a verification row whose value
// is the user being signed in (better-auth/dist/plugins/two-factor).
const TWO_FACTOR_COOKIE = "two_factor"

// Who was signed in when a request started, kept until its after hook.
const beforeByRequest = new WeakMap<Request, AccountState>()

function isTracked(path: string) {
  return (
    path === "/sign-in/email" ||
    isSsoCallback(path) ||
    PATHS_NEEDING_BEFORE.has(path)
  )
}

function twoFactorEnabledOf(user: object) {
  return "twoFactorEnabled" in user && user.twoFactorEnabled === true
}

function errorCodeOf(returned: unknown) {
  if (!isAPIError(returned)) return null
  const code = returned.body?.code
  if (typeof code !== "string") return null
  return code
}

function stringField(body: unknown, field: string) {
  if (typeof body !== "object" || body === null || !(field in body)) {
    return null
  }
  const value: unknown = Reflect.get(body, field)
  if (typeof value !== "string") return null
  return value
}

/** Keeps the signed-in user of the requests whose traces need them. */
export const accountTraceBefore = createAuthMiddleware(async (ctx) => {
  if (!ctx.request || !PATHS_NEEDING_BEFORE.has(ctx.path)) return
  const session = await getSessionFromCtx(ctx)
  if (!session) return
  beforeByRequest.set(ctx.request, {
    userId: session.user.id,
    name: session.user.name,
    twoFactorEnabled: twoFactorEnabledOf(session.user),
  })
})

/**
 * Records the account traces of a finished request (`account-traces.ts`
 * decides which). A failure to record is logged and never breaks sign-in.
 */
export const accountTraceAfter = createAuthMiddleware(async (ctx) => {
  if (!isTracked(ctx.path)) return
  try {
    const before = beforeOf(ctx.request)
    const returned = ctx.context.returned
    const failed = isAPIError(returned)
    const adapter = ctx.context.internalAdapter
    const headers = headersOf(ctx.request)

    // The user after the request, for the paths that change them.
    const afterOf = async () => {
      if (!before || failed) return null
      const user = await adapter.findUserById(before.userId)
      if (!user) return null
      return { name: user.name, twoFactorEnabled: twoFactorEnabledOf(user) }
    }
    // The account a failed sign-in was for; none for an unknown email.
    const emailUserIdOf = async () => {
      const email = stringField(ctx.body, "email")
      if (!failed || ctx.path !== "/sign-in/email" || !email) return null
      const found = await adapter.findUserByEmail(email)
      return found?.user.id ?? null
    }
    // The user a failed two-step code was for, from the plugin's cookie.
    const twoFactorUserIdOf = async () => {
      if (!failed || before || !ctx.path.startsWith("/two-factor/verify-")) {
        return null
      }
      const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE)
      const identifier = await ctx.getSignedCookie(
        cookie.name,
        ctx.context.secret
      )
      if (!identifier) return null
      const verification = await adapter.findVerificationValue(identifier)
      return verification?.value ?? null
    }

    const traces = accountTracesFor({
      path: ctx.path,
      failed,
      errorCode: errorCodeOf(returned),
      newSessionUserId: ctx.context.newSession?.user.id ?? null,
      before,
      after: await afterOf(),
      emailUserId: await emailUserIdOf(),
      twoFactorUserId: await twoFactorUserIdOf(),
      userAgent: headers.get("user-agent"),
    })
    const ipAddress = clientIpFrom(headers)
    for (const { userId, trace } of traces) {
      await writeTraces(db, userId, ipAddress, [trace])
    }
  } catch (error) {
    ctx.context.logger.error("Failed to record an account trace", error)
  }
})

function headersOf(request: Request | undefined) {
  if (!request) return new Headers()
  return request.headers
}

function beforeOf(request: Request | undefined) {
  if (!request) return null
  return beforeByRequest.get(request) ?? null
}
