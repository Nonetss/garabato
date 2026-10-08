import { openapi } from "@orpc/openapi"
import { adminProcedure } from "#index"

import { organizationHandler } from "#v1/organization/handler"
import { organizationInput } from "#v1/organization/input"
import { organizationOutput } from "#v1/organization/output"

export const organizationRouter = {
  list: adminProcedure
    .meta(
      openapi({
        summary: "List organizations",
        description: "Lists every organization in the system.",
        tags: ["Admin - Organizations", "Admin"],
        method: "GET",
      })
    )
    .output(organizationOutput.list)
    .handler(() => organizationHandler.list()),

  get: adminProcedure
    .meta(
      openapi({
        summary: "Get an organization",
        description:
          "Gets an organization by id together with its members, teams, pending invitations, and custom roles.",
        tags: ["Admin - Organizations", "Admin"],
        method: "GET",
      })
    )
    .input(organizationInput.get)
    .output(organizationOutput.get)
    .handler(({ input }) => organizationHandler.get({ input })),

  create: adminProcedure
    .meta(
      openapi({
        summary: "Create an organization",
        description:
          "Creates a new organization with the given name, slug and optional logo. The slug must be unique across the system and match `^[a-z0-9-]+$`; duplicates are rejected as conflicts.",
        tags: ["Admin - Organizations", "Admin"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(organizationInput.create)
    .output(organizationOutput.create)
    .handler(({ input }) => organizationHandler.create({ input })),

  update: adminProcedure
    .meta(
      openapi({
        summary: "Update an organization",
        description:
          "Partially updates an existing organization by id. Any of `name`, `slug` and `logo` may be provided; omitted fields are left unchanged.",
        tags: ["Admin - Organizations", "Admin"],
        method: "PATCH",
      })
    )
    .input(organizationInput.update)
    .output(organizationOutput.update)
    .handler(({ input }) => organizationHandler.update({ input })),

  delete: adminProcedure
    .meta(
      openapi({
        summary: "Delete an organization",
        description:
          "Permanently deletes the organization identified by id, along with its members, teams, invitations and custom roles.",
        tags: ["Admin - Organizations", "Admin"],
        method: "DELETE",
      })
    )
    .input(organizationInput.delete)
    .output(organizationOutput.delete)
    .handler(({ input }) => organizationHandler.delete({ input })),

  search: adminProcedure
    .meta(
      openapi({
        summary: "Search organizations",
        description:
          "Type-ahead search for organizations by name or slug, for suggestion-style pickers. Returns a small, unpaginated list.",
        tags: ["Admin - Organizations", "Admin"],
        method: "GET",
      })
    )
    .input(organizationInput.search)
    .output(organizationOutput.search)
    .handler(({ input }) => organizationHandler.search({ input })),

  addMember: adminProcedure
    .meta(
      openapi({
        summary: "Add a member to an organization",
        description:
          "Adds an existing user (by id) to an organization with the given role. The role may be one of the built-in role names (`owner`, `admin`, `member`) or any custom role defined for this organization; otherwise the request is rejected. Adding a user who is already a member returns a conflict.",
        tags: ["Admin - Organizations", "Admin"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(organizationInput.addMember)
    .output(organizationOutput.member)
    .handler(({ input }) => organizationHandler.addMember({ input })),

  updateMemberRole: adminProcedure
    .meta(
      openapi({
        summary: "Update a member's role",
        description:
          "Changes the role of an existing member (by member id) to a built-in or custom role of the same organization. An unknown role is rejected as a validation error.",
        tags: ["Admin - Organizations", "Admin"],
        method: "PATCH",
      })
    )
    .input(organizationInput.updateMemberRole)
    .output(organizationOutput.member)
    .handler(({ input }) => organizationHandler.updateMemberRole({ input })),

  removeMember: adminProcedure
    .meta(
      openapi({
        summary: "Remove a member from an organization",
        description:
          "Removes the membership row identified by member id. The underlying user account is preserved.",
        tags: ["Admin - Organizations", "Admin"],
        method: "DELETE",
      })
    )
    .input(organizationInput.removeMember)
    .output(organizationOutput.removeMember)
    .handler(({ input }) => organizationHandler.removeMember({ input })),

  listInvitations: adminProcedure
    .meta(
      openapi({
        summary: "List invitations for an organization",
        description:
          "Returns every invitation (pending, accepted, rejected and canceled) recorded for the given organization, newest first.",
        tags: ["Admin - Organizations", "Admin"],
        method: "GET",
      })
    )
    .input(organizationInput.listInvitations)
    .output(organizationOutput.invitations)
    .handler(({ input }) => organizationHandler.listInvitations({ input })),

  createInvitation: adminProcedure
    .meta(
      openapi({
        summary: "Invite a user to an organization",
        description:
          "Creates a pending invitation for the given email with the given built-in or custom role, optionally scoped to a team. The invitation expires after 7 days and the calling user is recorded as the inviter. No email or other notification is sent — delivery is the admin's responsibility outside the system.",
        tags: ["Admin - Organizations", "Admin"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(organizationInput.createInvitation)
    .output(organizationOutput.invitation)
    .handler(({ context, input }) =>
      organizationHandler.createInvitation({ context, input })
    ),

  cancelInvitation: adminProcedure
    .meta(
      openapi({
        summary: "Cancel a pending invitation",
        description:
          "Marks an existing pending invitation as `canceled` by id. The invitation row is preserved; only its status changes.",
        tags: ["Admin - Organizations", "Admin"],
        method: "DELETE",
      })
    )
    .input(organizationInput.cancelInvitation)
    .output(organizationOutput.cancelInvitation)
    .handler(({ input }) => organizationHandler.cancelInvitation({ input })),

  listTeams: adminProcedure
    .meta(
      openapi({
        summary: "List teams",
        description: "Lists teams, optionally filtered by organization.",
        tags: ["Admin - Teams", "Admin"],
        method: "GET",
      })
    )
    .input(organizationInput.listTeams)
    .output(organizationOutput.teams)
    .handler(({ input }) => organizationHandler.listTeams({ input })),

  searchTeams: adminProcedure
    .meta(
      openapi({
        summary: "Search teams",
        description:
          "Type-ahead search for teams by name, optionally scoped to an organization, for suggestion-style pickers. Returns a small, unpaginated list.",
        tags: ["Admin - Teams", "Admin"],
        method: "GET",
      })
    )
    .input(organizationInput.searchTeams)
    .output(organizationOutput.searchTeams)
    .handler(({ input }) => organizationHandler.searchTeams({ input })),

  createTeam: adminProcedure
    .meta(
      openapi({
        summary: "Create a team",
        description:
          "Creates a new team in the given organization. The team is created empty; members are added through `addTeamMember`.",
        tags: ["Admin - Teams", "Admin"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(organizationInput.createTeam)
    .output(organizationOutput.team)
    .handler(({ input }) => organizationHandler.createTeam({ input })),

  updateTeam: adminProcedure
    .meta(
      openapi({
        summary: "Update a team",
        description:
          "Renames an existing team by id. The team's organization membership is not changed.",
        tags: ["Admin - Teams", "Admin"],
        method: "PATCH",
      })
    )
    .input(organizationInput.updateTeam)
    .output(organizationOutput.team)
    .handler(({ input }) => organizationHandler.updateTeam({ input })),

  deleteTeam: adminProcedure
    .meta(
      openapi({
        summary: "Delete a team",
        description:
          "Deletes a team by id along with its team-membership rows. The organization and its other members are unaffected.",
        tags: ["Admin - Teams", "Admin"],
        method: "DELETE",
      })
    )
    .input(organizationInput.deleteTeam)
    .output(organizationOutput.deleteTeam)
    .handler(({ input }) => organizationHandler.deleteTeam({ input })),

  listTeamMembers: adminProcedure
    .meta(
      openapi({
        summary: "List team members",
        description:
          "Returns every user that belongs to the team identified by `teamId`, alongside a short user summary for each membership.",
        tags: ["Admin - Teams", "Admin"],
        method: "GET",
      })
    )
    .input(organizationInput.listTeamMembers)
    .output(organizationOutput.teamMembers)
    .handler(({ input }) => organizationHandler.listTeamMembers({ input })),

  addTeamMember: adminProcedure
    .meta(
      openapi({
        summary: "Add a member to a team",
        description:
          "Adds an existing user (by id) to the team identified by `teamId`. The user must already be a member of the team's organization. Adding a user who is already on the team returns a conflict.",
        tags: ["Admin - Teams", "Admin"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(organizationInput.addTeamMember)
    .output(organizationOutput.teamMember)
    .handler(({ input }) => organizationHandler.addTeamMember({ input })),

  removeTeamMember: adminProcedure
    .meta(
      openapi({
        summary: "Remove a member from a team",
        description:
          "Removes the membership of a user (by id) from the team identified by `teamId`. The user's organization membership and account are preserved.",
        tags: ["Admin - Teams", "Admin"],
        method: "DELETE",
      })
    )
    .input(organizationInput.removeTeamMember)
    .output(organizationOutput.removeTeamMember)
    .handler(({ input }) => organizationHandler.removeTeamMember({ input })),

  listRoles: adminProcedure
    .meta(
      openapi({
        summary: "List custom roles for an organization",
        description:
          "Returns every custom role created for the given organization, each with its resource-to-actions permission map, newest first.",
        tags: ["Admin - Roles", "Admin"],
        method: "GET",
      })
    )
    .input(organizationInput.listRoles)
    .output(organizationOutput.roles)
    .handler(({ input }) => organizationHandler.listRoles({ input })),

  createRole: adminProcedure
    .meta(
      openapi({
        summary: "Create a custom role for an organization",
        description:
          "Defines a new custom role for the given organization with a name (which must not collide with a built-in role from `@nonete/auth/permissions`) and a partial resource-to-actions permission map.",
        tags: ["Admin - Roles", "Admin"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(organizationInput.createRole)
    .output(organizationOutput.role)
    .handler(({ input }) => organizationHandler.createRole({ input })),

  deleteRole: adminProcedure
    .meta(
      openapi({
        summary: "Delete a custom role",
        description:
          "Deletes a custom role by id. Members still holding the role will keep holding the (now dangling) role string until an admin changes it.",
        tags: ["Admin - Roles", "Admin"],
        method: "DELETE",
      })
    )
    .input(organizationInput.deleteRole)
    .output(organizationOutput.deleteRole)
    .handler(({ input }) => organizationHandler.deleteRole({ input })),
}
