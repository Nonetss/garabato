import { defaultStatements, roles } from "@nonete/auth/permissions"
import type { OrganizationRole } from "@/features/admin/organizations/model/types"

export const roleLabel: Record<OrganizationRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
}

export const resourceLabel: Record<string, string> = {
  organization: "Organización",
  member: "Miembros",
  invitation: "Invitaciones",
  team: "Equipos",
  ac: "Gestión de roles",
}

export const actionLabel: Record<string, string> = {
  create: "crear",
  update: "actualizar",
  delete: "eliminar",
  cancel: "cancelar",
  read: "leer",
}

export function describePermissions(
  statements: Record<string, readonly string[]>
): string {
  const parts = Object.entries(statements)
    .filter(([, actions]) => actions.length > 0)
    .map(([resource, actions]) => {
      const label = resourceLabel[resource] ?? resource
      const actionsText = actions
        .map((action) => actionLabel[action] ?? action)
        .join(", ")
      return `${label}: ${actionsText}`
    })
  return parts.length > 0 ? parts.join(" · ") : "Sin permisos adicionales"
}

export const roleOptions = (Object.keys(roles) as OrganizationRole[]).map(
  (value) => ({
    value,
    label: roleLabel[value],
    description: describePermissions(roles[value].statements),
  })
)

/** Every assignable resource/action pair, used to build the custom-role permission picker. */
export const permissionMatrix = Object.entries(defaultStatements).map(
  ([resource, actions]) => ({
    resource,
    label: resourceLabel[resource] ?? resource,
    actions: actions.map((action) => ({
      value: action,
      label: actionLabel[action] ?? action,
    })),
  })
)
