import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import type { Organization } from "@/features/admin/organizations/model/types"
import { formatDate } from "@/lib/format"
import { iconRef } from "@/lib/icon-registry"

export interface OrganizationsRowContext {
  onOpenDetail: (id: string) => void
  onEdit: (organization: Organization) => void
  onDelete: (organization: Organization) => void
}

export const organizationListDefinition: EntityListDefinition<
  Organization,
  OrganizationsRowContext
> = {
  getKey: (org) => org.id,
  getAccessibleLabel: (org) => org.name,
  getPrimary: (org) => org.name,
  getSecondary: (org) => `/${org.slug}`,
  onOpen: (org, ctx) => ctx.onOpenDetail(org.id),
  metadata: [
    {
      key: "members",
      label: "Miembros",
      value: (org) => <span className="tabular-nums">{org.memberCount}</span>,
    },
    {
      key: "teams",
      label: "Equipos",
      value: (org) => <span className="tabular-nums">{org.teamCount}</span>,
    },
    {
      key: "created",
      label: "Creada",
      value: (org) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDate(org.createdAt)}
        </span>
      ),
    },
  ],
  actions: [
    {
      key: "members",
      label: "Ver miembros",
      icon: iconRef("admin", "users"),
      onSelect: (org, ctx) => ctx.onOpenDetail(org.id),
    },
    {
      key: "edit",
      label: "Editar",
      icon: iconRef("actions", "edit"),
      onSelect: (org, ctx) => ctx.onEdit(org),
    },
    {
      key: "delete",
      label: "Eliminar",
      icon: iconRef("actions", "delete"),
      destructive: true,
      onSelect: (org, ctx) => ctx.onDelete(org),
    },
  ],
}
