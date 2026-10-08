import { roles } from "@nonete/auth/permissions"
import { db } from "@nonete/db"
import {
  invitation,
  member,
  organization,
  organizationRole,
  team,
  teamMember,
} from "@nonete/db/schema/auth"
import { and, eq } from "drizzle-orm"
import type { z } from "zod"

import type { Context } from "#context"
import { errors } from "#errors"
import { toIso } from "#shared/dates"
import { assertFound } from "#shared/not-found"
import { likePattern } from "#shared/search"
import type { organizationInput } from "#v1/organization/input"

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7

async function assertAssignableRole(organizationId: string, role: string) {
  if (role in roles) return
  const customRole = await db.query.organizationRole.findFirst({
    where: { organizationId, role },
  })
  if (!customRole) {
    throw errors.BAD_REQUEST({
      message: `El rol "${role}" no existe en esta organización`,
    })
  }
}

function toUserSummary(user: {
  id: string
  name: string
  email: string
  image: string | null
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  }
}

async function loadOrganizationListItem(id: string) {
  const row = assertFound(
    await db.query.organization.findFirst({
      where: { id },
      with: { members: true, teams: true },
    })
  )
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo: row.logo,
    createdAt: toIso(row.createdAt),
    memberCount: row.members.length,
    teamCount: row.teams.length,
  }
}

async function loadMemberItem(memberId: string) {
  const row = await db.query.member.findFirst({
    where: { id: memberId },
    with: { user: true },
  })
  if (!row?.user) throw errors.NOT_FOUND()
  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    createdAt: toIso(row.createdAt),
    user: toUserSummary(row.user),
  }
}

function toRoleItem(row: {
  id: string
  organizationId: string
  role: string
  permission: string
  createdAt: Date
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    role: row.role,
    permission: JSON.parse(row.permission) as Record<string, string[]>,
    createdAt: toIso(row.createdAt),
  }
}

async function loadTeamItem(teamId: string) {
  const row = assertFound(
    await db.query.team.findFirst({
      where: { id: teamId },
      with: { teamMembers: true },
    })
  )
  return {
    id: row.id,
    name: row.name,
    organizationId: row.organizationId,
    memberCount: row.teamMembers.length,
    createdAt: toIso(row.createdAt),
  }
}

export const organizationHandler = {
  list: async () => {
    const rows = await db.query.organization.findMany({
      with: { members: true, teams: true },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo: row.logo,
      createdAt: toIso(row.createdAt),
      memberCount: row.members.length,
      teamCount: row.teams.length,
    }))
  },

  get: async ({ input }: { input: z.infer<typeof organizationInput.get> }) => {
    const row = assertFound(
      await db.query.organization.findFirst({
        where: { id: input.id },
        with: {
          members: { with: { user: true } },
          teams: { with: { teamMembers: true } },
          invitations: true,
          roles: true,
        },
      })
    )

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo: row.logo,
      createdAt: toIso(row.createdAt),
      memberCount: row.members.length,
      teamCount: row.teams.length,
      members: row.members
        .filter((m): m is typeof m & { user: NonNullable<typeof m.user> } =>
          Boolean(m.user)
        )
        .map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          createdAt: toIso(m.createdAt),
          user: toUserSummary(m.user),
        })),
      teams: row.teams.map((t) => ({
        id: t.id,
        name: t.name,
        organizationId: t.organizationId,
        memberCount: t.teamMembers.length,
        createdAt: toIso(t.createdAt),
      })),
      invitations: row.invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        teamId: i.teamId,
        expiresAt: toIso(i.expiresAt),
        createdAt: toIso(i.createdAt),
        inviterId: i.inviterId,
      })),
      roles: row.roles.map(toRoleItem),
    }
  },

  create: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.create>
  }) => {
    const existing = await db.query.organization.findFirst({
      where: { slug: input.slug },
    })
    if (existing) {
      throw errors.CONFLICT({
        message: "Ya existe una organización con ese slug",
      })
    }

    const [row] = await db
      .insert(organization)
      .values({
        id: crypto.randomUUID(),
        name: input.name,
        slug: input.slug,
        logo: input.logo ?? null,
        createdAt: new Date(),
      })
      .returning()
    if (!row) throw errors.INTERNAL_SERVER_ERROR()

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo: row.logo,
      createdAt: toIso(row.createdAt),
      memberCount: 0,
      teamCount: 0,
    }
  },

  update: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.update>
  }) => {
    const { id, ...rest } = input
    const [row] = await db
      .update(organization)
      .set(rest)
      .where(eq(organization.id, id))
      .returning()
    return loadOrganizationListItem(assertFound(row).id)
  },

  delete: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.delete>
  }) => {
    await db.delete(organization).where(eq(organization.id, input.id))
    return { id: input.id, success: true }
  },

  search: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.search>
  }) => {
    const pattern = likePattern(input.query)
    const rows = await db.query.organization.findMany({
      where: {
        OR: [{ name: { ilike: pattern } }, { slug: { ilike: pattern } }],
      },
      orderBy: { name: "asc" },
      limit: input.limit,
    })
    return rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }))
  },

  addMember: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.addMember>
  }) => {
    await assertAssignableRole(input.organizationId, input.role)

    const existing = await db.query.member.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    })
    if (existing) {
      throw errors.CONFLICT({
        message: "El usuario ya es miembro de esta organización",
      })
    }

    const [row] = await db
      .insert(member)
      .values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
        createdAt: new Date(),
      })
      .returning()
    if (!row) throw errors.INTERNAL_SERVER_ERROR()

    return loadMemberItem(row.id)
  },

  updateMemberRole: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.updateMemberRole>
  }) => {
    const existing = assertFound(
      await db.query.member.findFirst({
        where: { id: input.memberId },
      })
    )
    await assertAssignableRole(existing.organizationId, input.role)

    const [row] = await db
      .update(member)
      .set({ role: input.role })
      .where(eq(member.id, input.memberId))
      .returning()
    if (!row) throw errors.INTERNAL_SERVER_ERROR()
    return loadMemberItem(row.id)
  },

  removeMember: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.removeMember>
  }) => {
    await db.delete(member).where(eq(member.id, input.memberId))
    return { id: input.memberId, success: true }
  },

  listInvitations: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.listInvitations>
  }) => {
    const rows = await db.query.invitation.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      teamId: i.teamId,
      expiresAt: toIso(i.expiresAt),
      createdAt: toIso(i.createdAt),
      inviterId: i.inviterId,
    }))
  },

  createInvitation: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof organizationInput.createInvitation>
  }) => {
    if (!context.user) throw errors.UNAUTHORIZED()
    await assertAssignableRole(input.organizationId, input.role)

    const [row] = await db
      .insert(invitation)
      .values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        teamId: input.teamId ?? null,
        status: "pending",
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        inviterId: context.user.id,
      })
      .returning()
    if (!row) throw errors.INTERNAL_SERVER_ERROR()

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      teamId: row.teamId,
      expiresAt: toIso(row.expiresAt),
      createdAt: toIso(row.createdAt),
      inviterId: row.inviterId,
    }
  },

  cancelInvitation: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.cancelInvitation>
  }) => {
    await db
      .update(invitation)
      .set({ status: "canceled" })
      .where(eq(invitation.id, input.id))
    return { id: input.id, success: true }
  },

  listTeams: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.listTeams>
  }) => {
    const rows = await db.query.team.findMany({
      where: input.organizationId
        ? { organizationId: input.organizationId }
        : undefined,
      with: { teamMembers: true },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      organizationId: t.organizationId,
      memberCount: t.teamMembers.length,
      createdAt: toIso(t.createdAt),
    }))
  },

  searchTeams: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.searchTeams>
  }) => {
    const pattern = likePattern(input.query)
    const rows = await db.query.team.findMany({
      where: {
        name: { ilike: pattern },
        ...(input.organizationId
          ? { organizationId: input.organizationId }
          : {}),
      },
      orderBy: { name: "asc" },
      limit: input.limit,
    })
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      organizationId: row.organizationId,
    }))
  },

  createTeam: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.createTeam>
  }) => {
    const [row] = await db
      .insert(team)
      .values({
        id: crypto.randomUUID(),
        name: input.name,
        organizationId: input.organizationId,
        createdAt: new Date(),
      })
      .returning()
    if (!row) throw errors.INTERNAL_SERVER_ERROR()

    return {
      id: row.id,
      name: row.name,
      organizationId: row.organizationId,
      memberCount: 0,
      createdAt: toIso(row.createdAt),
    }
  },

  updateTeam: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.updateTeam>
  }) => {
    const [row] = await db
      .update(team)
      .set({ name: input.name })
      .where(eq(team.id, input.id))
      .returning()
    return loadTeamItem(assertFound(row).id)
  },

  deleteTeam: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.deleteTeam>
  }) => {
    await db.delete(team).where(eq(team.id, input.id))
    return { id: input.id, success: true }
  },

  listTeamMembers: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.listTeamMembers>
  }) => {
    const rows = await db.query.teamMember.findMany({
      where: { teamId: input.teamId },
      with: { user: true },
    })
    return rows
      .filter((tm): tm is typeof tm & { user: NonNullable<typeof tm.user> } =>
        Boolean(tm.user)
      )
      .map((tm) => ({
        teamId: tm.teamId,
        userId: tm.userId,
        user: toUserSummary(tm.user),
      }))
  },

  addTeamMember: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.addTeamMember>
  }) => {
    const existing = await db.query.teamMember.findFirst({
      where: { teamId: input.teamId, userId: input.userId },
    })
    if (existing) {
      throw errors.CONFLICT({
        message: "El usuario ya pertenece a este equipo",
      })
    }

    const [row] = await db
      .insert(teamMember)
      .values({
        id: crypto.randomUUID(),
        teamId: input.teamId,
        userId: input.userId,
        createdAt: new Date(),
      })
      .returning()
    if (!row) throw errors.INTERNAL_SERVER_ERROR()

    const user = assertFound(
      await db.query.user.findFirst({
        where: { id: row.userId },
      })
    )

    return {
      teamId: row.teamId,
      userId: row.userId,
      user: toUserSummary(user),
    }
  },

  removeTeamMember: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.removeTeamMember>
  }) => {
    await db
      .delete(teamMember)
      .where(
        and(
          eq(teamMember.teamId, input.teamId),
          eq(teamMember.userId, input.userId)
        )
      )
    return { success: true }
  },

  listRoles: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.listRoles>
  }) => {
    const rows = await db.query.organizationRole.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: "desc" },
    })
    return rows.map(toRoleItem)
  },

  createRole: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.createRole>
  }) => {
    const existing = await db.query.organizationRole.findFirst({
      where: { organizationId: input.organizationId, role: input.role },
    })
    if (existing) {
      throw errors.CONFLICT({
        message: "Ya existe un rol con ese nombre en esta organización",
      })
    }

    const [row] = await db
      .insert(organizationRole)
      .values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        role: input.role,
        permission: JSON.stringify(input.permission),
        createdAt: new Date(),
      })
      .returning()
    if (!row) throw errors.INTERNAL_SERVER_ERROR()

    return toRoleItem(row)
  },

  deleteRole: async ({
    input,
  }: {
    input: z.infer<typeof organizationInput.deleteRole>
  }) => {
    await db.delete(organizationRole).where(eq(organizationRole.id, input.id))
    return { id: input.id, success: true }
  },
}
