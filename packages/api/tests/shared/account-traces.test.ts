import { describe, expect, test } from "bun:test"
import {
  type AccountEvent,
  accountTracesFor,
} from "@nonete/auth/account-traces"

const UA =
  "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0"
const ana = { userId: "user-1", name: "Ana", twoFactorEnabled: false }

function event(overrides: Partial<AccountEvent>): AccountEvent {
  return {
    path: "/sign-in/email",
    failed: false,
    errorCode: null,
    newSessionUserId: null,
    before: null,
    after: null,
    emailUserId: null,
    twoFactorUserId: null,
    userAgent: UA,
    ...overrides,
  }
}

describe("sign-in", () => {
  test("a password sign-in records the method and the user agent", () => {
    expect(accountTracesFor(event({ newSessionUserId: "user-1" }))).toEqual([
      {
        userId: "user-1",
        trace: {
          type: "account.signedIn",
          details: { method: "password", userAgent: UA },
        },
      },
    ])
  })

  test("a single sign-on callback records the sso method", () => {
    const [trace] = accountTracesFor(
      event({ path: "/oauth2/callback/oidc", newSessionUserId: "user-1" })
    )

    expect(trace?.trace.details).toEqual({ method: "sso", userAgent: UA })
  })

  test("the password step of a two-step sign-in records nothing yet", () => {
    expect(accountTracesFor(event({}))).toEqual([])
  })

  test("the two-step code completes the sign-in", () => {
    const [trace] = accountTracesFor(
      event({ path: "/two-factor/verify-totp", newSessionUserId: "user-1" })
    )

    expect(trace?.trace.type).toBe("account.signedIn")
  })
})

describe("sign-in failures", () => {
  test("a wrong password is traced for the account the email belongs to", () => {
    expect(
      accountTracesFor(
        event({
          failed: true,
          errorCode: "INVALID_EMAIL_OR_PASSWORD",
          emailUserId: "user-1",
        })
      )
    ).toEqual([
      {
        userId: "user-1",
        trace: {
          type: "account.signInFailed",
          details: { reason: "wrong-password" },
        },
      },
    ])
  })

  test("a banned account is traced as banned", () => {
    const [trace] = accountTracesFor(
      event({ failed: true, errorCode: "BANNED_USER", emailUserId: "user-1" })
    )

    expect(trace?.trace.details).toEqual({ reason: "banned" })
  })

  test("an email no account has leaves no trace", () => {
    expect(
      accountTracesFor(
        event({ failed: true, errorCode: "INVALID_EMAIL_OR_PASSWORD" })
      )
    ).toEqual([])
  })

  test("other failures (rate limit, unverified email) leave no trace", () => {
    expect(
      accountTracesFor(
        event({
          failed: true,
          errorCode: "EMAIL_NOT_VERIFIED",
          emailUserId: "user-1",
        })
      )
    ).toEqual([])
  })

  test("a wrong two-step code at sign-in is traced for that user", () => {
    expect(
      accountTracesFor(
        event({
          path: "/two-factor/verify-totp",
          failed: true,
          twoFactorUserId: "user-1",
        })
      )
    ).toEqual([
      { userId: "user-1", trace: { type: "account.twoFactorFailed" } },
    ])
  })

  test("a wrong code while enrolling is not a sign-in failure", () => {
    expect(
      accountTracesFor(
        event({
          path: "/two-factor/verify-totp",
          failed: true,
          before: ana,
          twoFactorUserId: "user-1",
        })
      )
    ).toEqual([])
  })
})

describe("account changes", () => {
  test("verifying the first code turns two-step verification on", () => {
    expect(
      accountTracesFor(
        event({
          path: "/two-factor/verify-totp",
          before: ana,
          after: { name: "Ana", twoFactorEnabled: true },
          newSessionUserId: "user-1",
        })
      )
    ).toEqual([
      { userId: "user-1", trace: { type: "account.twoFactorEnabled" } },
    ])
  })

  test("turning it off, changing the password and signing out", () => {
    const types = ["/two-factor/disable", "/change-password", "/sign-out"].map(
      (path) => accountTracesFor(event({ path, before: ana }))[0]?.trace.type
    )

    expect(types).toEqual([
      "account.twoFactorDisabled",
      "account.passwordChanged",
      "account.signedOut",
    ])
  })

  test("a new name keeps the previous and the new one", () => {
    expect(
      accountTracesFor(
        event({
          path: "/update-user",
          before: ana,
          after: { name: "Ana López", twoFactorEnabled: false },
        })
      )
    ).toEqual([
      {
        userId: "user-1",
        trace: {
          type: "account.nameChanged",
          details: { from: "Ana", to: "Ana López" },
        },
      },
    ])
  })

  test("an update that keeps the name leaves no trace", () => {
    expect(
      accountTracesFor(
        event({
          path: "/update-user",
          before: ana,
          after: { name: "Ana", twoFactorEnabled: false },
        })
      )
    ).toEqual([])
  })

  test("without a session nothing is traced for these paths", () => {
    expect(accountTracesFor(event({ path: "/sign-out" }))).toEqual([])
  })
})
