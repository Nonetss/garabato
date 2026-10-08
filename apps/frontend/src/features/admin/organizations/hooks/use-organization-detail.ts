import type {
  OrganizationCustomRole,
  OrganizationDetail,
  OrganizationInvitation,
  OrganizationMember,
} from "@/features/admin/organizations/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

const orgListKey = orpc.v1.organization.list.queryKey()

const detailKey = (organizationId: string) =>
  orpc.v1.organization.get.queryKey({ input: { id: organizationId } })

export const useOrganizationDetail = (organizationId: string | null) =>
  useHydratedQuery({
    ...orpc.v1.organization.get.queryOptions({
      input: { id: organizationId ?? "" },
    }),
    enabled: !!organizationId,
  })

type AddMemberInput = {
  organizationId: string
  userId: string
  role: string
}
type RemoveMemberOutput = { id: string; success: boolean }

export const useMemberAdd = (organizationId: string) =>
  useResourceMutation<AddMemberInput, OrganizationMember, OrganizationDetail>({
    mutationFn: (input) => orpc.v1.organization.addMember.call(input),
    listKey: detailKey(organizationId),
    extraInvalidate: [orgListKey],
    messages: {
      success: "Miembro añadido",
      error: "No se pudo añadir el miembro",
    },
  })

export const useMemberRoleUpdate = (organizationId: string) =>
  useResourceMutation<
    { memberId: string; role: string },
    OrganizationMember,
    OrganizationDetail
  >({
    mutationFn: (input) => orpc.v1.organization.updateMemberRole.call(input),
    listKey: detailKey(organizationId),
    messages: {
      success: "Rol actualizado",
      error: "No se pudo actualizar el rol",
    },
  })

export const useMemberRemove = (organizationId: string) =>
  useResourceMutation<
    { memberId: string },
    RemoveMemberOutput,
    OrganizationDetail
  >({
    mutationFn: (input) => orpc.v1.organization.removeMember.call(input),
    listKey: detailKey(organizationId),
    extraInvalidate: [orgListKey],
    messages: {
      success: "Miembro eliminado",
      error: "No se pudo eliminar el miembro",
    },
  })

type CreateInvitationInput = {
  organizationId: string
  email: string
  role: string
  teamId?: string
}
type CancelInvitationOutput = { id: string; success: boolean }

export const useInvitationCreate = (organizationId: string) =>
  useResourceMutation<
    CreateInvitationInput,
    OrganizationInvitation,
    OrganizationDetail
  >({
    mutationFn: (input) => orpc.v1.organization.createInvitation.call(input),
    listKey: detailKey(organizationId),
    messages: {
      success: "Invitación enviada",
      error: "No se pudo enviar la invitación",
    },
  })

export const useInvitationCancel = (organizationId: string) =>
  useResourceMutation<
    { id: string },
    CancelInvitationOutput,
    OrganizationDetail
  >({
    mutationFn: (input) => orpc.v1.organization.cancelInvitation.call(input),
    listKey: detailKey(organizationId),
    messages: {
      success: "Invitación cancelada",
      error: "No se pudo cancelar la invitación",
    },
  })

type CreateRoleInput = {
  organizationId: string
  role: string
  permission: Record<string, string[]>
}
type DeleteRoleOutput = { id: string; success: boolean }

export const useRoleCreate = (organizationId: string) =>
  useResourceMutation<
    CreateRoleInput,
    OrganizationCustomRole,
    OrganizationDetail
  >({
    mutationFn: (input) => orpc.v1.organization.createRole.call(input),
    listKey: detailKey(organizationId),
    messages: {
      success: "Rol creado",
      error: "No se pudo crear el rol",
    },
  })

export const useRoleRemove = (organizationId: string) =>
  useResourceMutation<{ id: string }, DeleteRoleOutput, OrganizationDetail>({
    mutationFn: (input) => orpc.v1.organization.deleteRole.call(input),
    listKey: detailKey(organizationId),
    messages: {
      success: "Rol eliminado",
      error: "No se pudo eliminar el rol",
    },
  })
