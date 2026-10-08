import { defaultStatements, roles } from "@nonete/auth/permissions"
import { z } from "zod"

import { searchLimit, searchQuery } from "#shared/search"

const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones")

// Built-in role or the name of a custom role created for the organization
// (validated against that organization's custom roles in the handler).
const assignableRole = z.string().min(1)

const permission = z
  .object(
    Object.fromEntries(
      Object.entries(defaultStatements).map(([resource, actions]) => [
        resource,
        z.array(z.enum([...actions] as [string, ...string[]])).optional(),
      ])
    )
  )
  .partial()

export const organizationInput = {
  get: z.object({
    id: z.string().describe("The id of the organization"),
  }),
  create: z.object({
    name: z.string().min(1).describe("The name of the organization"),
    slug: slug.describe("The slug of the organization"),
    logo: z.string().url().optional().describe("The logo URL"),
  }),
  update: z.object({
    id: z.string().describe("The id of the organization"),
    name: z.string().min(1).optional().describe("The name of the organization"),
    slug: slug.optional().describe("The slug of the organization"),
    logo: z.string().url().nullish().describe("The logo URL"),
  }),
  delete: z.object({
    id: z.string().describe("The id of the organization to delete"),
  }),
  search: z.object({
    query: searchQuery().describe("Match against name or slug"),
    limit: searchLimit(),
  }),

  addMember: z.object({
    organizationId: z.string().describe("The organization id"),
    userId: z.string().describe("The user id to add as a member"),
    role: assignableRole.describe(
      "The role to assign to the new member (built-in or custom)"
    ),
  }),
  updateMemberRole: z.object({
    memberId: z.string().describe("The member id"),
    role: assignableRole.describe(
      "The new role for the member (built-in or custom)"
    ),
  }),
  removeMember: z.object({
    memberId: z.string().describe("The member id to remove"),
  }),

  listInvitations: z.object({
    organizationId: z.string().describe("The organization id"),
  }),
  createInvitation: z.object({
    organizationId: z.string().describe("The organization id"),
    email: z.string().email().describe("The email to invite"),
    role: assignableRole.describe(
      "The role to assign once accepted (built-in or custom)"
    ),
    teamId: z.string().optional().describe("Optional team id to invite into"),
  }),
  cancelInvitation: z.object({
    id: z.string().describe("The invitation id to cancel"),
  }),

  listTeams: z.object({
    organizationId: z
      .string()
      .optional()
      .describe("Filter teams by organization id"),
  }),
  searchTeams: z.object({
    query: searchQuery().describe("Match against team name"),
    organizationId: z
      .string()
      .optional()
      .describe("Restrict the search to this organization"),
    limit: searchLimit(),
  }),
  createTeam: z.object({
    organizationId: z.string().describe("The organization id"),
    name: z.string().min(1).describe("The name of the team"),
  }),
  updateTeam: z.object({
    id: z.string().describe("The team id"),
    name: z.string().min(1).describe("The new name of the team"),
  }),
  deleteTeam: z.object({
    id: z.string().describe("The team id to delete"),
  }),

  listTeamMembers: z.object({
    teamId: z.string().describe("The team id"),
  }),
  addTeamMember: z.object({
    teamId: z.string().describe("The team id"),
    userId: z.string().describe("The user id to add to the team"),
  }),
  removeTeamMember: z.object({
    teamId: z.string().describe("The team id"),
    userId: z.string().describe("The user id to remove from the team"),
  }),

  listRoles: z.object({
    organizationId: z.string().describe("The organization id"),
  }),
  createRole: z.object({
    organizationId: z.string().describe("The organization id"),
    role: z
      .string()
      .min(1)
      .refine((value) => !(value in roles), {
        message: "Ese nombre coincide con un rol predefinido",
      })
      .describe("The unique name of the custom role"),
    permission: permission.describe("Resource to allowed-actions map"),
  }),
  deleteRole: z.object({
    id: z.string().describe("The custom role id to delete"),
  }),
}
