import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { auth } from "@nonete/auth"
import { type AppResource, appStatements } from "@nonete/auth/permissions"
import { browserTokenSettingsRow, userRow } from "@nonete/db/testing"
import { type AnyProcedure, call, ORPCError } from "@orpc/server"

import type { Context } from "#context"
import {
  adminContext,
  anonymousContext,
  cronContext,
  userContext,
} from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { refusedTokenKey, verifiedTokenKey } from "#tests/fixtures/token"

const hasOrganizationPermission = mock(async (_: unknown) => false)

// Replaced before `#index` loads so the builders bind to the mock instead of
// the Better Auth call.
mock.module("#lib/permissions", () => ({
  userHasOrganizationPermission: hasOrganizationPermission,
}))

const {
  adminProcedure,
  cronProcedure,
  permissionProcedure,
  protectedProcedure,
  publicProcedure,
  tokenProcedure,
} = await import("#index")

const verifyApiKey = spyOn(auth.api, "verifyApiKey")
const updateApiKey = spyOn(auth.api, "updateApiKey")

// Any declared app permission works; the builder's logic doesn't depend on it.
const resource = Object.keys(appStatements)[0] as AppResource
const action = appStatements[resource][0]

const ok = () => "ok" as const

const procedures = {
  public: publicProcedure.handler(ok),
  protected: protectedProcedure.handler(ok),
  admin: adminProcedure.handler(ok),
  permission: permissionProcedure(resource, action).handler(ok),
  cron: cronProcedure.handler(ok),
  token: tokenProcedure.handler(({ context }) => context.token),
}

function run(procedure: AnyProcedure, context: Context) {
  return call(procedure, undefined, { context })
}

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown
  )
  expect(error).toBeInstanceOf(ORPCError)
  expect((error as ORPCError<string, unknown>).code).toBe(code)
}

beforeEach(() => {
  fakeDb.reset()
  verifyApiKey.mockReset()
  updateApiKey.mockReset()
  hasOrganizationPermission.mockReset()
  hasOrganizationPermission.mockResolvedValue(false)
})

describe("publicProcedure", () => {
  test("lets an anonymous caller through", async () => {
    expect(await run(procedures.public, anonymousContext())).toBe("ok")
  })
})

describe("protectedProcedure", () => {
  test("rejects an anonymous caller with UNAUTHORIZED", async () => {
    await expectCode(
      run(procedures.protected, anonymousContext()),
      "UNAUTHORIZED"
    )
  })

  test("lets a signed-in user through", async () => {
    expect(await run(procedures.protected, userContext())).toBe("ok")
  })
})

describe("adminProcedure", () => {
  test("rejects an anonymous caller with UNAUTHORIZED", async () => {
    await expectCode(run(procedures.admin, anonymousContext()), "UNAUTHORIZED")
  })

  test("rejects a non-admin user with FORBIDDEN", async () => {
    await expectCode(run(procedures.admin, userContext()), "FORBIDDEN")
  })

  test("lets an admin through", async () => {
    expect(await run(procedures.admin, adminContext())).toBe("ok")
  })
})

describe("permissionProcedure", () => {
  test("rejects a caller without user or session with UNAUTHORIZED", async () => {
    await expectCode(
      run(procedures.permission, anonymousContext()),
      "UNAUTHORIZED"
    )
    await expectCode(
      run(procedures.permission, { ...userContext("org-id"), session: null }),
      "UNAUTHORIZED"
    )
    expect(hasOrganizationPermission).not.toHaveBeenCalled()
  })

  test("rejects a non-admin without an active organization with FORBIDDEN", async () => {
    await expectCode(run(procedures.permission, userContext()), "FORBIDDEN")
    expect(hasOrganizationPermission).not.toHaveBeenCalled()
  })

  test("rejects a non-admin the organization check denies with FORBIDDEN", async () => {
    await expectCode(
      run(procedures.permission, userContext("org-id")),
      "FORBIDDEN"
    )
    expect(hasOrganizationPermission).toHaveBeenCalledTimes(1)
  })

  test("asks for the requested permission in the active organization", async () => {
    hasOrganizationPermission.mockResolvedValue(true)
    const context = userContext("org-id")

    expect(await run(procedures.permission, context)).toBe("ok")
    expect(hasOrganizationPermission).toHaveBeenCalledWith({
      organizationId: "org-id",
      headers: context.headers,
      resource,
      action,
    })
  })

  test("lets an admin through without consulting the organization check", async () => {
    expect(await run(procedures.permission, adminContext())).toBe("ok")
    expect(hasOrganizationPermission).not.toHaveBeenCalled()
  })
})

describe("cronProcedure", () => {
  test("rejects an admin without the scheduler marker with FORBIDDEN", async () => {
    await expectCode(run(procedures.cron, adminContext()), "FORBIDDEN")
  })

  test("lets a scheduler-marked context through", async () => {
    expect(await run(procedures.cron, cronContext())).toBe("ok")
    expect(await run(procedures.cron, cronContext(anonymousContext()))).toBe(
      "ok"
    )
  })
})

describe("tokenProcedure", () => {
  function withKey(key: string, module = "0.2.0 linux-x86_64") {
    return {
      ...anonymousContext(),
      headers: new Headers({ "x-api-key": key, "x-garabato-module": module }),
    }
  }

  function ownerWithTwoFactor() {
    verifyApiKey.mockResolvedValue(
      verifiedTokenKey({
        metadata: { moduleVersion: "0.2.0", platform: "linux-x86_64" },
      })
    )
    fakeDb.queue(
      "query.user.findFirst",
      userRow({ id: "user-id", twoFactorEnabled: true })
    )
  }

  test("rejects a request without a token key with UNAUTHORIZED", async () => {
    await expectCode(run(procedures.token, userContext()), "UNAUTHORIZED")
    expect(verifyApiKey).not.toHaveBeenCalled()
  })

  test("rejects an unknown key with UNAUTHORIZED", async () => {
    verifyApiKey.mockResolvedValue(refusedTokenKey())

    await expectCode(run(procedures.token, withKey("sk_gone")), "UNAUTHORIZED")
  })

  test("rejects an ordinary API key with UNAUTHORIZED", async () => {
    verifyApiKey.mockResolvedValue(verifiedTokenKey({ permissions: null }))

    await expectCode(run(procedures.token, withKey("sk_plain")), "UNAUTHORIZED")
  })

  test("rejects an owner without two-factor with FORBIDDEN", async () => {
    verifyApiKey.mockResolvedValue(verifiedTokenKey())
    fakeDb.queue("query.user.findFirst", userRow({ id: "user-id" }))

    await expectCode(run(procedures.token, withKey("sk_token")), "FORBIDDEN")
  })

  test("rejects a banned owner with UNAUTHORIZED", async () => {
    verifyApiKey.mockResolvedValue(verifiedTokenKey())
    fakeDb.queue(
      "query.user.findFirst",
      userRow({ id: "user-id", twoFactorEnabled: true, banned: true })
    )

    await expectCode(run(procedures.token, withKey("sk_token")), "UNAUTHORIZED")
  })

  test("puts the key, its owner and the module in the context", async () => {
    ownerWithTwoFactor()
    fakeDb.queue("query.browserTokenSettings.findFirst", undefined)

    expect(await run(procedures.token, withKey("sk_token"))).toEqual({
      userId: "user-id",
      keyId: "key-1",
      keyName: "Firefox portátil",
      module: { version: "0.2.0", platform: "linux-x86_64" },
    })
    expect(updateApiKey).not.toHaveBeenCalled()
  })

  test("refuses with SERVICE_UNAVAILABLE while the token is off", async () => {
    ownerWithTwoFactor()
    fakeDb.queue(
      "query.browserTokenSettings.findFirst",
      browserTokenSettingsRow({ tokenEnabled: false })
    )

    await expectCode(
      run(procedures.token, withKey("sk_token")),
      "SERVICE_UNAVAILABLE"
    )
  })

  test("refuses an outdated module with PRECONDITION_FAILED", async () => {
    ownerWithTwoFactor()
    fakeDb.queue(
      "query.browserTokenSettings.findFirst",
      browserTokenSettingsRow({ minModuleVersion: "0.3.0" })
    )

    await expectCode(
      run(procedures.token, withKey("sk_token")),
      "PRECONDITION_FAILED"
    )
  })

  test("treats a module without the header as 0.1.0 and remembers it", async () => {
    ownerWithTwoFactor()
    fakeDb.queue(
      "query.browserTokenSettings.findFirst",
      browserTokenSettingsRow({ minModuleVersion: "0.2.0" })
    )
    const context = {
      ...anonymousContext(),
      headers: new Headers({ "x-api-key": "sk_token" }),
    }

    await expectCode(run(procedures.token, context), "PRECONDITION_FAILED")
    expect(updateApiKey).toHaveBeenCalledWith({
      body: {
        keyId: "key-1",
        userId: "user-id",
        metadata: { moduleVersion: "0.1.0", platform: "unknown" },
      },
    })
  })
})

describe("access meta", () => {
  test.each([
    ["public", "public"],
    ["protected", "protected"],
    ["admin", "admin"],
    ["permission", "admin"],
    ["cron", "cron"],
    ["token", "token"],
  ] as const)("%s builder stamps access %p", (builder, access) => {
    expect(procedures[builder]["~orpc"].meta.access).toBe(access)
  })
})
