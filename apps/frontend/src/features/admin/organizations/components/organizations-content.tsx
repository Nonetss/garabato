import { getIcon } from "@/lib/icon-registry"

const Building2 = getIcon("entities", "organization")
const Plus = getIcon("actions", "add")

import { useCallback, useDeferredValue, useMemo, useState } from "react"
import type { SuggestInputItem } from "@/components/shared/form/suggest-input"
import { HeroCount } from "@/components/shared/layout/page-hero"
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
import { OrganizationDetailSheet } from "@/features/admin/organizations/components/organization-detail-sheet"
import { OrganizationFormDialog } from "@/features/admin/organizations/components/organization-form-dialog"
import { organizationListDefinition } from "@/features/admin/organizations/definitions/organization-list.definition"
import {
  useOrganizationDelete,
  useOrganizationsList,
} from "@/features/admin/organizations/hooks/use-organizations"
import type { Organization } from "@/features/admin/organizations/model/types"
import { useEditDialog } from "@/hooks/use-edit-dialog"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { useTargetDialog } from "@/hooks/use-target-dialog"
import { foldText, textSuggestions } from "@/lib/fold-text"

export function OrganizationsContent() {
  const {
    data: organizations = [],
    isPending,
    isError,
    refetch,
  } = useOrganizationsList()
  const deleteOrganization = useOrganizationDelete()

  const [search, setSearch] = useState("")

  const editDialog = useEditDialog<Organization>()
  const detailDialog = useTargetDialog<string>()
  const deleteDialog = useTargetConfirmDialog<Organization>({
    title: "Eliminar organización",
    description: (org) =>
      `Esta acción no se puede deshacer. Se eliminarán «${org.name}» junto con sus miembros, equipos e invitaciones.`,
    confirmLabel: "Eliminar",
    onConfirm: (org) => deleteOrganization.mutateAsync({ id: org.id }),
  })

  const normalizedSearch = search.trim().toLowerCase()
  // Keystrokes commit immediately; the filtered list catches up in a
  // lower-priority render instead of blocking the input.
  const searchTerm = useDeferredValue(normalizedSearch)
  const filteredOrganizations = useMemo(
    () =>
      organizations.filter(
        (org) =>
          !searchTerm ||
          org.name.toLowerCase().includes(searchTerm) ||
          org.slug.toLowerCase().includes(searchTerm)
      ),
    [organizations, searchTerm]
  )
  const activeFilterCount = normalizedSearch ? 1 : 0
  const clearFilters = () => setSearch("")

  const searchSuggestions = useMemo<SuggestInputItem[]>(
    () =>
      textSuggestions(organizations, search, {
        match: (org, q) =>
          foldText(org.name).includes(q) || foldText(org.slug).includes(q),
        toItem: (org) => ({
          key: org.id,
          value: org.name,
          label: org.name,
          detail: `/${org.slug}`,
        }),
      }),
    [organizations, search]
  )

  const filterDescriptors: ResourceFilterDescriptor[] = [
    {
      kind: "suggestion",
      key: "org-filter-search",
      label: "Buscar",
      value: search,
      onChange: setSearch,
      suggestions: searchSuggestions,
      placeholder: "Nombre o slug…",
    },
  ]
  // Search applies live, so the sheet's draft total is the current count.
  const fetchDraftTotal = useCallback(
    () => filteredOrganizations.length,
    [filteredOrganizations.length]
  )

  return (
    <>
      <ResourceOverview
        maxWidth="80%"
        surface="admin-organizations"
        description="Gestiona las organizaciones, sus miembros e invitaciones."
        heroMeta={
          <HeroCount
            segments={[{ count: organizations.length, label: "total" }]}
          />
        }
        heroAction={
          <Button onClick={editDialog.openCreate}>
            <Plus className="size-4" />
            Nueva organización
          </Button>
        }
        filters={
          !isError && !isPending && organizations.length > 0 ? (
            <div className="space-y-3">
              <ResourceFilters
                columns={1}
                filters={filterDescriptors}
                onClear={clearFilters}
                fetchDraftTotal={fetchDraftTotal}
                count={
                  filteredOrganizations.length === organizations.length
                    ? `${organizations.length} organizaciones`
                    : `${filteredOrganizations.length} de ${organizations.length} organizaciones`
                }
              />
              <FilterChips
                chips={chipsFor(filterDescriptors)}
                onClear={clearFilters}
              />
            </div>
          ) : undefined
        }
        query={{ data: filteredOrganizations, isPending, isError, refetch }}
        loading="Cargando organizaciones…"
        error={{
          icon: <Building2 className="size-6" />,
          title: "No se pudieron cargar las organizaciones",
          description:
            "Comprueba tu conexión y tus permisos de administración; después, vuelve a intentarlo.",
        }}
        isEmpty={(data) => data.length === 0}
        empty={{
          icon: <Building2 className="size-6" />,
          title: "No hay organizaciones",
          description: "Todavía no se ha creado ninguna organización.",
          action: (
            <Button onClick={editDialog.openCreate}>Nueva organización</Button>
          ),
        }}
        hasActiveFilters={activeFilterCount > 0}
        filteredEmpty={{
          icon: <Building2 className="size-6" />,
          title: "Sin resultados",
          description: "Ninguna organización coincide con la búsqueda.",
          onClear: clearFilters,
        }}
      >
        {(data) => (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EntityList
              items={data}
              context={{
                onOpenDetail: detailDialog.open,
                onEdit: editDialog.openEdit,
                onDelete: deleteDialog.open,
              }}
              definition={organizationListDefinition}
            />
          </div>
        )}
      </ResourceOverview>

      <OrganizationFormDialog
        organization={editDialog.editing}
        {...editDialog.dialogProps}
      />

      <OrganizationDetailSheet
        organizationId={detailDialog.target}
        onOpenChange={detailDialog.dialogProps.onOpenChange}
      />

      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
