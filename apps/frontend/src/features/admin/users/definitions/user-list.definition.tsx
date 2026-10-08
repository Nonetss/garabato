import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import type { UserRow } from "@/features/admin/users/model/types"
import { isAdminUser } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { iconRef } from "@/lib/icon-registry"
import { userDisplayName } from "@/lib/user-display"

export interface UsersRowContext {
  currentUserId: string | undefined
  onChangePassword: (user: UserRow) => void
  onToggleAdmin: (user: UserRow) => void
  onUnban: (userId: string) => void
  onBan: (user: UserRow) => void
  onDelete: (user: UserRow) => void
}

/** The users overview's `EntityList` row definition: identity, ban status,
 *  role/created metadata and the password/admin/ban/delete actions. */
export const userListDefinition: EntityListDefinition<
  UserRow,
  UsersRowContext
> = {
  getKey: (user) => user.id,
  getAccessibleLabel: (user) => userDisplayName(user),
  getPrimary: (user) => userDisplayName(user),
  getSecondary: (user) => user.email,
  getStatus: (user) => {
    const isBanned = !!user.banned
    return {
      tone: isBanned ? "destructive" : "primary",
      label: isBanned ? "Baneado" : "Activo",
      title: isBanned ? (user.banReason ?? undefined) : undefined,
    }
  },
  metadata: [
    {
      key: "role",
      label: "Rol",
      value: (user) => (isAdminUser(user) ? "Administrador" : "Usuario"),
    },
    {
      key: "created",
      label: "Creado",
      value: (user) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDate(user.createdAt)}
        </span>
      ),
    },
  ],
  actions: [
    {
      key: "changePassword",
      label: "Cambiar contraseña",
      icon: iconRef("entities", "apiKey"),
      onSelect: (user, ctx) => ctx.onChangePassword(user),
    },
    {
      key: "toggleAdmin",
      label: (user) => (isAdminUser(user) ? "Quitar admin" : "Hacer admin"),
      icon: (user) =>
        isAdminUser(user)
          ? iconRef("security", "restricted")
          : iconRef("security", "security"),
      disabled: (user, ctx) => user.id === ctx.currentUserId,
      onSelect: (user, ctx) => ctx.onToggleAdmin(user),
    },
    {
      key: "banToggle",
      label: (user) => (user.banned ? "Quitar baneo" : "Banear"),
      icon: (user) =>
        user.banned
          ? iconRef("security", "restricted")
          : iconRef("identity", "userX"),
      disabled: (user, ctx) => user.id === ctx.currentUserId,
      onSelect: (user, ctx) =>
        user.banned ? ctx.onUnban(user.id) : ctx.onBan(user),
    },
    {
      key: "delete",
      label: "Eliminar",
      icon: iconRef("actions", "delete"),
      destructive: true,
      disabled: (user, ctx) => user.id === ctx.currentUserId,
      onSelect: (user, ctx) => ctx.onDelete(user),
    },
  ],
}
