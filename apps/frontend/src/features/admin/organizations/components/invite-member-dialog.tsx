import type { SyntheticEvent } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { EntityPicker } from "@/components/shared/form/entity-picker"
import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Input } from "@/components/ui/input"
import { RoleSelect } from "@/features/admin/organizations/components/role-select"
import { useInvitationCreate } from "@/features/admin/organizations/hooks/use-organization-detail"
import type { OrganizationCustomRole } from "@/features/admin/organizations/model/types"
import {
  type TeamSearchResult,
  useTeamSearch,
} from "@/features/admin/teams/public"
import { useDialogForm } from "@/hooks/use-dialog-form"
import { cn } from "@/lib/utils"

interface InviteMemberDialogProps {
  organizationId: string
  customRoles: OrganizationCustomRole[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteMemberDialog({
  organizationId,
  customRoles,
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const { mutateAsync, isPending } = useInvitationCreate(organizationId)
  const form = useDialogForm(open, {
    email: "",
    role: "member",
    teamSearchInput: "",
    selectedTeam: null as TeamSearchResult | null,
  })

  const { isSearchable, isFetching, results } = useTeamSearch(
    form.values.teamSearchInput,
    organizationId
  )

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { email, role, selectedTeam } = form.trimmed()
    await mutateAsync({
      organizationId,
      email,
      role,
      teamId: selectedTeam?.id,
    })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invitar a la organización"
      description="Crea una invitación pendiente. No se envía correo: comparte el enlace manualmente."
      onSubmit={handleSubmit}
      isPending={isPending}
      submitLabel="Invitar"
    >
      <FormField label="Email" htmlFor="invite-email">
        <Input
          id="invite-email"
          type="email"
          required
          value={form.values.email}
          onChange={(e) => form.set("email", e.target.value)}
        />
      </FormField>
      <FormField label="Rol" htmlFor="invite-role">
        <RoleSelect
          id="invite-role"
          className="w-full"
          value={form.values.role}
          onValueChange={(role) => form.set("role", role)}
          customRoles={customRoles}
          showDescription
        />
      </FormField>
      <FormField label="Equipo (opcional)" htmlFor="invite-team-search">
        <EntityPicker
          id="invite-team-search"
          searchInput={form.values.teamSearchInput}
          onSearchInputChange={(value) => form.set("teamSearchInput", value)}
          isSearchable={isSearchable}
          isFetching={isFetching}
          results={results}
          getKey={(team) => team.id}
          renderResult={(team) => (
            <span className={cn(textVariants({ role: "title" }), "truncate")}>
              {team.name}
            </span>
          )}
          selected={form.values.selectedTeam}
          onSelect={(team) => {
            form.set("selectedTeam", team)
            form.set("teamSearchInput", "")
          }}
          onClear={() => form.set("selectedTeam", null)}
          renderSelected={(team) => (
            <Text variant="title" className="truncate">
              {team.name}
            </Text>
          )}
          clearLabel="Quitar equipo"
          placeholder="Nombre del equipo..."
        />
      </FormField>
    </FormDialog>
  )
}
