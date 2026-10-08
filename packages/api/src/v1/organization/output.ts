import { z } from "zod"

const userSummary = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
})

const memberItem = z.object({
  id: z.string().describe("The member id"),
  userId: z.string().describe("The user id"),
  role: z.string().describe("The member's role"),
  createdAt: z.string().describe("When the membership was created"),
  user: userSummary,
})

const teamItem = z.object({
  id: z.string().describe("The team id"),
  name: z.string().describe("The team name"),
  organizationId: z
    .string()
    .describe("The organization id the team belongs to"),
  memberCount: z.number().describe("Number of members in the team"),
  createdAt: z.string().describe("When the team was created"),
})

const roleItem = z.object({
  id: z.string().describe("The custom role id"),
  organizationId: z.string().describe("The organization id"),
  role: z.string().describe("The role name"),
  permission: z
    .record(z.string(), z.array(z.string()))
    .describe("Resource to allowed-actions map"),
  createdAt: z.string().describe("When the role was created"),
})

const invitationItem = z.object({
  id: z.string().describe("The invitation id"),
  email: z.string().describe("The invited email"),
  role: z.string().nullable().describe("The role to assign once accepted"),
  status: z.string().describe("pending | accepted | rejected | canceled"),
  teamId: z.string().nullable().describe("Optional team id"),
  expiresAt: z.string().describe("When the invitation expires"),
  createdAt: z.string().describe("When the invitation was created"),
  inviterId: z.string().describe("The user id who sent the invitation"),
})

const organizationListItem = z.object({
  id: z.string().describe("The organization id"),
  name: z.string().describe("The organization name"),
  slug: z.string().describe("The organization slug"),
  logo: z.string().nullable().describe("The organization logo URL"),
  createdAt: z.string().describe("When the organization was created"),
  memberCount: z.number().describe("Number of members"),
  teamCount: z.number().describe("Number of teams"),
})

const organizationSearchItem = z.object({
  id: z.string().describe("The organization id"),
  name: z.string().describe("The organization name"),
  slug: z.string().describe("The organization slug"),
})

const teamSearchItem = z.object({
  id: z.string().describe("The team id"),
  name: z.string().describe("The team name"),
  organizationId: z
    .string()
    .describe("The organization id the team belongs to"),
})

const organizationDetail = organizationListItem.extend({
  members: z.array(memberItem),
  teams: z.array(teamItem),
  invitations: z.array(invitationItem),
  roles: z.array(roleItem),
})

export const organizationOutput = {
  list: z.array(organizationListItem).describe("All organizations"),
  get: organizationDetail,
  create: organizationListItem,
  update: organizationListItem,
  delete: z.object({ id: z.string(), success: z.boolean() }),
  search: z.array(organizationSearchItem).describe("Matching organizations"),

  member: memberItem,
  removeMember: z.object({ id: z.string(), success: z.boolean() }),

  invitation: invitationItem,
  invitations: z.array(invitationItem),
  cancelInvitation: z.object({ id: z.string(), success: z.boolean() }),

  team: teamItem,
  teams: z.array(teamItem),
  deleteTeam: z.object({ id: z.string(), success: z.boolean() }),
  searchTeams: z.array(teamSearchItem).describe("Matching teams"),

  teamMember: z.object({
    teamId: z.string(),
    userId: z.string(),
    user: userSummary,
  }),
  teamMembers: z.array(
    z.object({
      teamId: z.string(),
      userId: z.string(),
      user: userSummary,
    })
  ),
  removeTeamMember: z.object({ success: z.boolean() }),

  role: roleItem,
  roles: z.array(roleItem),
  deleteRole: z.object({ id: z.string(), success: z.boolean() }),
}
