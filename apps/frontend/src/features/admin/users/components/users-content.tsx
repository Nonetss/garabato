import { getIcon } from "@/lib/icon-registry"

const Plus = getIcon("actions", "add")
const UsersIcon = getIcon("admin", "users")
const UserX = getIcon("identity", "userX")

import { useCallback, useMemo, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import type { SuggestInputItem } from "@/components/shared/form/suggest-input"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { ScrollPanel } from "@/components/shared/layout/scroll-panel"
import { EntityList } from "@/components/shared/resource/entity-list"
import { FilterChips } from "@/components/shared/resource/filter-chips"
import {
  chipsFor,
  type ResourceFilterDescriptor,
  ResourceFilters,
} from "@/components/shared/resource/resource-filters"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { BanUserDialog } from "@/features/admin/users/components/ban-user-dialog"
import { ChangePasswordDialog } from "@/features/admin/users/components/change-password-dialog"
import { CreateUserDialog } from "@/features/admin/users/components/create-user-dialog"
import { userListDefinition } from "@/features/admin/users/definitions/user-list.definition"
import { useUserMutations } from "@/features/admin/users/hooks/use-user-mutations"
import { useUsersList } from "@/features/admin/users/hooks/use-users-list"
import type { UserRow } from "@/features/admin/users/model/types"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { useTargetDialog } from "@/hooks/use-target-dialog"
import { authClient } from "@/lib/auth-client"
import { userDisplayName } from "@/lib/user-display"

export function UsersContent() {
  const { data: session } = authClient.useSession()
  const currentUserId = session?.user.id

  const {
    users,
    total,
    isPending,
    isError,
    refetch,
    searchInput,
    setSearchInput,
    page,
    setPage,
    pageSize,
  } = useUsersList()
  const { unbanUser, removeUser, setRole } = useUserMutations()

  const [createOpen, setCreateOpen] = useState(false)
  const passwordDialog = useTargetDialog<UserRow>()
  const banDialog = useTargetDialog<UserRow>()

  const deleteDialog = useTargetConfirmDialog<UserRow>({
    title: "Eliminar usuario",
    description: (user) =>
      `Esta acción no se puede deshacer. Se eliminará la cuenta de ${userDisplayName(user)} (${user.email}).`,
    confirmLabel: "Eliminar",
    onConfirm: (user) => removeUser.mutateAsync({ userId: user.id }),
  })

  const rows = users as UserRow[]
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)
  const hasNextPage = to < total
  const hasSearch = searchInput.trim() !== ""

  const searchSuggestions = useMemo<SuggestInputItem[]>(() => {
    if (!hasSearch) return []
    return rows.slice(0, 8).map((user) => ({
      key: user.id,
      value: user.email,
      label: userDisplayName(user),
      detail: user.email,
    }))
  }, [rows, hasSearch])

  const handleToggleAdmin = useCallback(
    (user: UserRow) => {
      setRole.mutate({
        userId: user.id,
        role: user.role === "admin" ? "user" : "admin",
      })
    },
    [setRole.mutate]
  )
  const handleUnban = useCallback(
    (userId: string) => {
      unbanUser.mutate({ userId })
    },
    [unbanUser.mutate]
  )

  const filterDescriptors: ResourceFilterDescriptor[] = [
    {
      kind: "suggestion",
      key: "user-filter-search",
      label: "Buscar",
      value: searchInput,
      onChange: setSearchInput,
      suggestions: searchSuggestions,
      placeholder: "Nombre o email...",
      isActive: () => hasSearch,
    },
  ]
  // Search applies live, so the sheet's draft total is the current total.
  const fetchDraftTotal = useCallback(() => total, [total])

  return (
    <>
      <ResourceOverview
        maxWidth="80%"
        surface="admin-users"
        description="Gestiona las cuentas de la aplicación."
        heroMeta={<HeroCount segments={[{ count: total, label: "total" }]} />}
        heroAction={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nuevo usuario
          </Button>
        }
        filters={
          !isError && (total > 0 || hasSearch) ? (
            <div className="space-y-3">
              <ResourceFilters
                columns={1}
                filters={filterDescriptors}
                onClear={() => setSearchInput("")}
                fetchDraftTotal={fetchDraftTotal}
                count={
                  total > 0
                    ? `${total} usuario${total === 1 ? "" : "s"}`
                    : undefined
                }
              />
              <FilterChips
                chips={chipsFor(filterDescriptors)}
                onClear={() => setSearchInput("")}
              />
            </div>
          ) : undefined
        }
        query={{ data: rows, isPending, isError, refetch }}
        loading="Cargando usuarios..."
        error={{
          icon: <UserX className="size-6" />,
          title: "No se pudo cargar la lista de usuarios",
          description:
            "Comprueba tu conexión y que tu sesión tenga permisos de administración.",
        }}
        isEmpty={(data) => data.length === 0}
        empty={{
          icon: <UsersIcon className="size-6" />,
          title: "No hay usuarios",
          description: "Todavía no se ha creado ningún usuario.",
        }}
        hasActiveFilters={hasSearch}
        filteredEmpty={{
          icon: <UsersIcon className="size-6" />,
          title: "Sin resultados",
          description: "Ningún usuario coincide con la búsqueda.",
          onClear: () => setSearchInput(""),
        }}
      >
        {(data) => (
          <ScrollPanel
            footer={
              <Text
                as="div"
                variant="meta"
                tone="muted"
                className="flex items-center justify-between"
              >
                <span className="tabular-nums">
                  {from}–{to} de {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </Text>
            }
          >
            <EntityList
              items={data}
              context={{
                currentUserId,
                onChangePassword: passwordDialog.open,
                onToggleAdmin: handleToggleAdmin,
                onUnban: handleUnban,
                onBan: banDialog.open,
                onDelete: deleteDialog.open,
              }}
              definition={userListDefinition}
              className="rounded-none border-0 bg-transparent"
            />
          </ScrollPanel>
        )}
      </ResourceOverview>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ChangePasswordDialog
        userId={passwordDialog.target?.id ?? null}
        userLabel={
          passwordDialog.target
            ? userDisplayName(passwordDialog.target)
            : undefined
        }
        onOpenChange={passwordDialog.dialogProps.onOpenChange}
      />

      <BanUserDialog
        userId={banDialog.target?.id ?? null}
        userLabel={
          banDialog.target ? userDisplayName(banDialog.target) : undefined
        }
        onOpenChange={banDialog.dialogProps.onOpenChange}
      />

      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
