import type { SyntheticEvent } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { EntityPicker } from "@/components/shared/form/entity-picker"
import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { RoleSelect } from "@/features/admin/organizations/components/role-select"
import { useMemberAdd } from "@/features/admin/organizations/hooks/use-organization-detail"
import type { OrganizationCustomRole } from "@/features/admin/organizations/model/types"
import { useAdminUserSearch } from "@/hooks/use-admin-user-search"
import { useDialogForm } from "@/hooks/use-dialog-form"
import { cn } from "@/lib/utils"

interface SelectedUser {
  id: string
  name: string
  email: string
}

interface AddMemberDialogProps {
  organizationId: string
  existingUserIds: string[]
  customRoles: OrganizationCustomRole[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMemberDialog({
  organizationId,
  existingUserIds,
  customRoles,
  open,
  onOpenChange,
}: AddMemberDialogProps) {
  const { mutateAsync, isPending } = useMemberAdd(organizationId)
  const form = useDialogForm(open, {
    searchInput: "",
    selectedUser: null as SelectedUser | null,
    role: "member",
  })

  const { isSearchable, isFetching, results } = useAdminUserSearch(
    form.values.searchInput
  )
  const availableResults = results.filter(
    (user) => !existingUserIds.includes(user.id)
  )

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { selectedUser, role } = form.values
    if (!selectedUser) return
    await mutateAsync({ organizationId, userId: selectedUser.id, role })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Añadir miembro"
      description="Busca un usuario existente y asígnale un rol en la organización."
      onSubmit={handleSubmit}
      isPending={isPending}
      submitDisabled={!form.values.selectedUser}
      submitLabel="Añadir"
    >
      <FormField label="Buscar usuario" htmlFor="member-search">
        <EntityPicker
          id="member-search"
          searchInput={form.values.searchInput}
          onSearchInputChange={(value) => form.set("searchInput", value)}
          isSearchable={isSearchable}
          isFetching={isFetching}
          results={availableResults}
          getKey={(user) => user.id}
          renderResult={(user) => (
            <>
              <span className={cn(textVariants({ role: "title" }), "truncate")}>
                {user.name}
              </span>
              <Text variant="compact" tone="muted" className="truncate">
                {user.email}
              </Text>
            </>
          )}
          selected={form.values.selectedUser}
          onSelect={(user) => form.set("selectedUser", user)}
          onClear={() => form.set("selectedUser", null)}
          renderSelected={(user) => (
            <>
              <Text as="p" variant="title" className="truncate">
                {user.name}
              </Text>
              <Text as="p" variant="compact" tone="muted" className="truncate">
                {user.email}
              </Text>
            </>
          )}
          clearLabel="Cambiar usuario"
          placeholder="Nombre o email…"
        />
      </FormField>

      <FormField label="Rol" htmlFor="member-role">
        <RoleSelect
          id="member-role"
          className="w-full"
          value={form.values.role}
          onValueChange={(role) => form.set("role", role)}
          customRoles={customRoles}
          showDescription
        />
      </FormField>
    </FormDialog>
  )
}
