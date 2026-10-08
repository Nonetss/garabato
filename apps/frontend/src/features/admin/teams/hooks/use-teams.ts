import type { Team, TeamMember } from "@/features/admin/teams/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

const teamsListKey = orpc.v1.organization.listTeams.queryKey({
  input: { organizationId: undefined },
})
const orgListKey = orpc.v1.organization.list.queryKey()

export const useTeamsList = () =>
  useHydratedQuery(
    orpc.v1.organization.listTeams.queryOptions({
      input: { organizationId: undefined },
    })
  )

type TeamCreateInput = { organizationId: string; name: string }
type TeamUpdateInput = { id: string; name: string }
type TeamDeleteOutput = { id: string; success: boolean }

function applyDeleteOptimistic(
  current: Team[] | undefined,
  input: { id: string }
) {
  if (!current) return current
  return current.filter((team) => team.id !== input.id)
}

export const useTeamCreate = () =>
  useResourceMutation<TeamCreateInput, Team, Team[]>({
    mutationFn: (input) => orpc.v1.organization.createTeam.call(input),
    listKey: teamsListKey,
    extraInvalidate: [orgListKey],
    messages: {
      success: "Equipo creado",
      error: "No se pudo crear el equipo",
    },
  })

export const useTeamUpdate = () =>
  useResourceMutation<TeamUpdateInput, Team, Team[]>({
    mutationFn: (input) => orpc.v1.organization.updateTeam.call(input),
    listKey: teamsListKey,
    messages: {
      success: "Equipo actualizado",
      error: "No se pudo actualizar el equipo",
    },
  })

export const useTeamDelete = () =>
  useResourceMutation<{ id: string }, TeamDeleteOutput, Team[]>({
    mutationFn: (input) => orpc.v1.organization.deleteTeam.call(input),
    listKey: teamsListKey,
    applyOptimistic: applyDeleteOptimistic,
    extraInvalidate: [orgListKey],
    messages: {
      success: "Equipo eliminado",
      error: "No se pudo eliminar el equipo",
    },
  })

const teamMembersKey = (teamId: string) =>
  orpc.v1.organization.listTeamMembers.queryKey({ input: { teamId } })

export const useTeamMembersList = (teamId: string | null) =>
  useHydratedQuery({
    ...orpc.v1.organization.listTeamMembers.queryOptions({
      input: { teamId: teamId ?? "" },
    }),
    enabled: !!teamId,
  })

type AddTeamMemberInput = { teamId: string; userId: string }
type RemoveTeamMemberOutput = { success: boolean }

export const useTeamMemberAdd = (teamId: string) =>
  useResourceMutation<AddTeamMemberInput, TeamMember, TeamMember[]>({
    mutationFn: (input) => orpc.v1.organization.addTeamMember.call(input),
    listKey: teamMembersKey(teamId),
    extraInvalidate: [teamsListKey],
    messages: {
      success: "Miembro añadido al equipo",
      error: "No se pudo añadir el miembro",
    },
  })

export const useTeamMemberRemove = (teamId: string) =>
  useResourceMutation<
    { teamId: string; userId: string },
    RemoveTeamMemberOutput,
    TeamMember[]
  >({
    mutationFn: (input) => orpc.v1.organization.removeTeamMember.call(input),
    listKey: teamMembersKey(teamId),
    extraInvalidate: [teamsListKey],
    messages: {
      success: "Miembro eliminado del equipo",
      error: "No se pudo eliminar el miembro",
    },
  })
