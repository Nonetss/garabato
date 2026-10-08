import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import type { Team } from "@/features/admin/teams/model/types"
import { formatDate } from "@/lib/format"
import { iconRef } from "@/lib/icon-registry"

export interface TeamsRowContext {
  orgNameById: Map<string, string>
  onOpenMembers: (team: Team) => void
  onEdit: (team: Team) => void
  onDelete: (team: Team) => void
}

export const teamListDefinition: EntityListDefinition<Team, TeamsRowContext> = {
  getKey: (team) => team.id,
  getAccessibleLabel: (team) => team.name,
  getPrimary: (team) => team.name,
  onOpen: (team, ctx) => ctx.onOpenMembers(team),
  metadata: [
    {
      key: "organization",
      label: "Organización",
      value: (team, ctx) => (
        <span className="truncate text-muted-foreground">
          {ctx.orgNameById.get(team.organizationId) ?? "—"}
        </span>
      ),
    },
    {
      key: "members",
      label: "Miembros",
      value: (team) => <span className="tabular-nums">{team.memberCount}</span>,
    },
    {
      key: "created",
      label: "Creado",
      value: (team) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDate(team.createdAt)}
        </span>
      ),
    },
  ],
  actions: [
    {
      key: "members",
      label: "Ver miembros",
      icon: iconRef("admin", "teams"),
      onSelect: (team, ctx) => ctx.onOpenMembers(team),
    },
    {
      key: "edit",
      label: "Editar",
      icon: iconRef("actions", "edit"),
      onSelect: (team, ctx) => ctx.onEdit(team),
    },
    {
      key: "delete",
      label: "Eliminar",
      icon: iconRef("actions", "delete"),
      destructive: true,
      onSelect: (team, ctx) => ctx.onDelete(team),
    },
  ],
}
