import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import type { ApiKeyListItem } from "@/features/admin/api-keys/model/types"
import { formatDate } from "@/lib/format"
import { iconRef } from "@/lib/icon-registry"

export interface ApiKeysRowContext {
  deletingId: string | null
  onDelete: (key: ApiKeyListItem) => void
}

export const apiKeyListDefinition: EntityListDefinition<
  ApiKeyListItem,
  ApiKeysRowContext
> = {
  getKey: (key) => key.id,
  getAccessibleLabel: (key) => key.name?.trim() || "Sin nombre",
  getPrimary: (key) => key.name?.trim() || "Sin nombre",
  getSecondary: (key) => key.start ?? key.prefix ?? `${key.id.slice(0, 8)}…`,
  getStatus: (key) => ({
    tone: key.enabled ? "primary" : "border",
    label: key.enabled ? "Activa" : "Pausa",
  }),
  isDisabled: (key, ctx) => ctx.deletingId === key.id,
  metadata: [
    {
      key: "created",
      label: "Creada",
      value: (key) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDate(key.createdAt)}
        </span>
      ),
    },
    {
      key: "expires",
      label: "Caducidad",
      value: (key) => (
        <span className="text-muted-foreground tabular-nums">
          {key.expiresAt ? formatDate(key.expiresAt) : "Sin caducidad"}
        </span>
      ),
    },
  ],
  actions: [
    {
      key: "delete",
      label: "Eliminar",
      icon: iconRef("actions", "delete"),
      destructive: true,
      onSelect: (key, ctx) => ctx.onDelete(key),
    },
  ],
}
