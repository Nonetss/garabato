import type { Organization } from "@/features/admin/organizations/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

export const useOrganizationsList = () =>
  useHydratedQuery(orpc.v1.organization.list.queryOptions())

const listKey = orpc.v1.organization.list.queryKey()

type OrganizationCreateInput = { name: string; slug: string; logo?: string }
type OrganizationUpdateInput = {
  id: string
  name?: string
  slug?: string
  logo?: string | null
}
type OrganizationDeleteOutput = { id: string; success: boolean }

function applyDeleteOptimistic(
  current: Organization[] | undefined,
  input: { id: string }
) {
  if (!current) return current
  return current.filter((org) => org.id !== input.id)
}

export const useOrganizationCreate = () =>
  useResourceMutation<OrganizationCreateInput, Organization, Organization[]>({
    mutationFn: (input) => orpc.v1.organization.create.call(input),
    listKey,
    messages: {
      success: "Organización creada",
      error: "No se pudo crear la organización",
    },
  })

export const useOrganizationUpdate = () =>
  useResourceMutation<OrganizationUpdateInput, Organization, Organization[]>({
    mutationFn: (input) => orpc.v1.organization.update.call(input),
    listKey,
    messages: {
      success: "Organización actualizada",
      error: "No se pudo actualizar la organización",
    },
  })

export const useOrganizationDelete = () =>
  useResourceMutation<{ id: string }, OrganizationDeleteOutput, Organization[]>(
    {
      mutationFn: (input) => orpc.v1.organization.delete.call(input),
      listKey,
      applyOptimistic: applyDeleteOptimistic,
      messages: {
        success: "Organización eliminada",
        error: "No se pudo eliminar la organización",
      },
    }
  )
