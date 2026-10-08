import { beforeEach, describe, expect, mock, test } from "bun:test"
import { type AppResource, appStatements } from "@nonete/auth/permissions"
import { type AnyProcedure, call, ORPCError } from "@orpc/server"

import type { Context } from "#context"
import {
  adminContext,
  anonymousContext,
  cronContext,
  userContext,
} from "./fixtures/context"

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
} = await import("#index")

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

describe("access meta", () => {
  test.each([
    ["public", "public"],
    ["protected", "protected"],
    ["admin", "admin"],
    ["permission", "admin"],
    ["cron", "cron"],
  ] as const)("%s builder stamps access %p", (builder, access) => {
    expect(procedures[builder]["~orpc"].meta.access).toBe(access)
  })
})
