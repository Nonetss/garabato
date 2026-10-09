import type { SyntheticEvent } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { EntityPicker } from "@/components/shared/form/entity-picker"
import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Input } from "@/components/ui/input"
import {
  type OrganizationSearchResult,
  useOrganizationSearch,
} from "@/features/admin/organizations/public"
import {
  useTeamCreate,
  useTeamUpdate,
} from "@/features/admin/teams/hooks/use-teams"
import type { Team } from "@/features/admin/teams/model/types"
import { useDialogForm } from "@/hooks/use-dialog-form"
import { cn } from "@/lib/utils"

interface TeamFormDialogProps {
  team: Team | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TeamFormDialog({
  team,
  open,
  onOpenChange,
}: TeamFormDialogProps) {
  const createTeam = useTeamCreate()
  const updateTeam = useTeamUpdate()
  const isEditing = !!team

  const form = useDialogForm(
    open,
    {
      name: "",
      orgSearchInput: "",
      selectedOrg: null as OrganizationSearchResult | null,
    },
    { name: team?.name ?? "" }
  )

  const { isSearchable, isFetching, results } = useOrganizationSearch(
    form.values.orgSearchInput
  )

  const isPending = createTeam.isPending || updateTeam.isPending

  const handleOpenChange = (next: boolean) => {
    if (isPending) return
    onOpenChange(next)
  }

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { name, selectedOrg } = form.trimmed()
    if (isEditing && team) {
      await updateTeam.mutateAsync({ id: team.id, name })
    } else {
      if (!selectedOrg) return
      await createTeam.mutateAsync({ organizationId: selectedOrg.id, name })
    }
    handleOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={isEditing ? "Editar equipo" : "Nuevo equipo"}
      description={
        isEditing
          ? "Cambia el nombre del equipo."
          : "Crea un equipo dentro de una organización."
      }
      onSubmit={handleSubmit}
      isPending={isPending}
      submitDisabled={!isEditing && !form.values.selectedOrg}
      submitLabel={isEditing ? "Guardar" : "Crear equipo"}
    >
      {!isEditing ? (
        <FormField label="Organización" htmlFor="team-org-search">
          <EntityPicker
            id="team-org-search"
            searchInput={form.values.orgSearchInput}
            onSearchInputChange={(value) => form.set("orgSearchInput", value)}
            isSearchable={isSearchable}
            isFetching={isFetching}
            results={results}
            getKey={(org) => org.id}
            renderResult={(org) => (
              <>
                <span
                  className={cn(textVariants({ role: "title" }), "truncate")}
                >
                  {org.name}
                </span>
                <Text variant="data" tone="muted" className="truncate">
                  /{org.slug}
                </Text>
              </>
            )}
            selected={form.values.selectedOrg}
            onSelect={(org) => {
              form.set("selectedOrg", org)
              form.set("orgSearchInput", "")
            }}
            onClear={() => form.set("selectedOrg", null)}
            renderSelected={(org) => (
              <>
                <Text as="p" variant="title" className="truncate">
                  {org.name}
                </Text>
                <Text as="p" variant="data" tone="muted" className="truncate">
                  /{org.slug}
                </Text>
              </>
            )}
            clearLabel="Cambiar organización"
            placeholder="Nombre o slug de la organización…"
          />
        </FormField>
      ) : null}

      <FormField label="Nombre" htmlFor="team-name">
        <Input
          id="team-name"
          required
          value={form.values.name}
          onChange={(e) => form.set("name", e.target.value)}
        />
      </FormField>
    </FormDialog>
  )
}
