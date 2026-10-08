import type { Session, User } from "better-auth"
import { getIcon } from "@/lib/icon-registry"

const Pencil = getIcon("actions", "edit")

import { useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { MetadataDefinitionList } from "@/components/shared/data-display/metadata-cell"
import { StatusTag } from "@/components/shared/data-display/status-dot"
import { Hint } from "@/components/shared/feedback/hint"
import { UserAvatar } from "@/components/shared/user/avatar"
import { Button } from "@/components/ui/button"
import { ChangePasswordDialog } from "@/features/profile/overview/components/change-password-dialog"
import { EditNameDialog } from "@/features/profile/overview/components/edit-name-dialog"
import { authClient } from "@/lib/auth-client"
import { formatDate } from "@/lib/format"
import { userDisplayName } from "@/lib/user-display"

export type ProfilePageProps = {
  user: User
  session: Session
}

export function ProfileContent({ user: initialUser }: ProfilePageProps) {
  const { data: session } = authClient.useSession()
  const user = session?.user ?? initialUser

  const [editNameOpen, setEditNameOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  if (!user) return null

  const displayName = userDisplayName(user)

  const role = (user as { role?: string }).role ?? "user"
  const createdAt = (user as { createdAt?: string | Date }).createdAt
  const emailVerified = (user as { emailVerified?: boolean }).emailVerified

  const roleLabel =
    role === "admin"
      ? "Administrador"
      : role === "pending"
        ? "Pendiente"
        : "Usuario"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 pt-[6vh]">
      <div className="flex items-center gap-4">
        <UserAvatar displayName={displayName} email={user.email} size="lg" />
        <div className="min-w-0">
          <Text as="p" variant="headline" className="truncate">
            {displayName}
          </Text>
          <Text as="p" variant="meta" tone="muted" className="truncate">
            {user.email}
          </Text>
          <Text
            as="p"
            variant="status"
            tone="muted"
            className="mt-1.5 flex items-center gap-2"
          >
            <StatusTag dotTone="primary">{roleLabel}</StatusTag>
            {emailVerified ? (
              <>
                <span className="text-border">·</span>
                Verificado
              </>
            ) : null}
          </Text>
        </div>
      </div>

      <MetadataDefinitionList
        columns={2}
        context={{ displayName, user, createdAt }}
        fields={[
          {
            key: "name",
            label: "Nombre",
            value: ({ displayName }) => displayName,
            action: (
              <Hint label="Editar nombre">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar nombre"
                  onClick={() => setEditNameOpen(true)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </Hint>
            ),
          },
          {
            key: "email",
            label: "Email",
            value: ({ user }) => user.email,
          },
          {
            key: "password",
            label: "Contraseña",
            value: () => (
              <>
                <span aria-hidden="true">••••••••</span>
                <span className="sr-only">Oculta</span>
              </>
            ),
            action: (
              <Hint label="Cambiar contraseña">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cambiar contraseña"
                  onClick={() => setChangePasswordOpen(true)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </Hint>
            ),
          },
          {
            key: "id",
            label: "ID de cuenta",
            value: ({ user }) => (
              <Text variant="data" className="select-all">
                {user.id}
              </Text>
            ),
          },
          {
            key: "createdAt",
            label: "Miembro desde",
            hidden: ({ createdAt }) => !createdAt,
            value: ({ createdAt }) => (
              <span className="tabular-nums">
                {createdAt ? formatDate(createdAt) : null}
              </span>
            ),
          },
        ]}
      />

      <EditNameDialog
        open={editNameOpen}
        currentName={user.name ?? ""}
        onOpenChange={setEditNameOpen}
      />
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  )
}
