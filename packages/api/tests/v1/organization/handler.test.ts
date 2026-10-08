import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test"
import {
  memberRow,
  NOW,
  organizationRow,
  stepArgs,
  userRow,
} from "@nonete/db/testing"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { expectErrorCode } from "#tests/fixtures/errors"
import { organizationHandler } from "#v1/organization/handler"

const ORG = "org-1"
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

beforeEach(() => fakeDb.reset())

afterEach(() => setSystemTime())

describe("organization roles", () => {
  test("addMember rejects a role that is neither built-in nor custom", async () => {
    fakeDb.queue("query.organizationRole.findFirst", undefined)

    await expectErrorCode(
      organizationHandler.addMember({
        input: { organizationId: ORG, userId: "user-1", role: "wizard" },
      }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("a built-in role skips the custom role lookup", async () => {
    fakeDb.queue("query.member.findFirst", undefined)
    fakeDb.queue("insert", [memberRow({ role: "admin" })])
    fakeDb.queue("query.member.findFirst", {
      ...memberRow({ role: "admin" }),
      user: userRow(),
    })

    const added = await organizationHandler.addMember({
      input: { organizationId: ORG, userId: "user-1", role: "admin" },
    })

    expect(fakeDb.calls("query.organizationRole.findFirst")).toEqual([])
    expect(added).toMatchObject({ userId: "user-1", role: "admin" })
  })

  test("a custom role of the organization is accepted", async () => {
    fakeDb.queue("query.organizationRole.findFirst", {
      id: "role-1",
      organizationId: ORG,
      role: "auditor",
      permission: "{}",
      createdAt: NOW,
      updatedAt: null,
    })
    fakeDb.queue("query.member.findFirst", memberRow())

    // Reaches the membership check, which is where this one stops.
    await expectErrorCode(
      organizationHandler.addMember({
        input: { organizationId: ORG, userId: "user-1", role: "auditor" },
      }),
      "CONFLICT"
    )
  })

  test("createInvitation rejects an unknown role", async () => {
    fakeDb.queue("query.organizationRole.findFirst", undefined)

    await expectErrorCode(
      organizationHandler.createInvitation({
        context: userContext(),
        input: {
          organizationId: ORG,
          email: "new@example.com",
          role: "wizard",
        },
      }),
      "BAD_REQUEST"
    )
  })
})

describe("organization members", () => {
  test("addMember rejects an existing member with CONFLICT", async () => {
    fakeDb.queue("query.member.findFirst", memberRow())

    await expectErrorCode(
      organizationHandler.addMember({
        input: { organizationId: ORG, userId: "user-1", role: "member" },
      }),
      "CONFLICT"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("updateMemberRole rejects a missing member with NOT_FOUND", async () => {
    fakeDb.queue("query.member.findFirst", undefined)

    await expectErrorCode(
      organizationHandler.updateMemberRole({
        input: { memberId: "missing", role: "admin" },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("update")).toEqual([])
  })
})

describe("organization lookups", () => {
  test("get rejects a missing organization with NOT_FOUND", async () => {
    fakeDb.queue("query.organization.findFirst", undefined)
    await expectErrorCode(
      organizationHandler.get({ input: { id: "missing" } }),
      "NOT_FOUND"
    )
  })

  test("create rejects a taken slug with CONFLICT", async () => {
    fakeDb.queue("query.organization.findFirst", organizationRow())
    await expectErrorCode(
      organizationHandler.create({ input: { name: "Acme 2", slug: "acme" } }),
      "CONFLICT"
    )
    expect(fakeDb.calls("insert")).toEqual([])
  })

  test("updateTeam rejects a missing team with NOT_FOUND", async () => {
    fakeDb.queue("update", [])
    await expectErrorCode(
      organizationHandler.updateTeam({ input: { id: "missing", name: "X" } }),
      "NOT_FOUND"
    )
  })
})

describe("organization invitations", () => {
  test("createInvitation records the inviter and a one-week expiry", async () => {
    setSystemTime(NOW)
    const expiresAt = new Date(NOW.getTime() + WEEK_MS)
    fakeDb.queue("insert", [
      {
        id: "inv-1",
        organizationId: ORG,
        email: "new@example.com",
        role: "member",
        teamId: null,
        status: "pending",
        expiresAt,
        createdAt: NOW,
        inviterId: "user-id",
      },
    ])

    const invitation = await organizationHandler.createInvitation({
      context: userContext(),
      input: { organizationId: ORG, email: "new@example.com", role: "member" },
    })

    const [insert] = fakeDb.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toMatchObject({
      inviterId: "user-id",
      status: "pending",
      teamId: null,
      expiresAt,
    })
    expect(invitation.expiresAt).toBe(expiresAt.toISOString())
  })
})
