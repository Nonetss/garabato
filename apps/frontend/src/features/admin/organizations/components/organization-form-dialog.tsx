import { type SyntheticEvent, useEffect, useState } from "react"
import { textVariants } from "@/components/shared/brand/typography"
import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Input } from "@/components/ui/input"
import {
  useOrganizationCreate,
  useOrganizationUpdate,
} from "@/features/admin/organizations/hooks/use-organizations"
import type { Organization } from "@/features/admin/organizations/model/types"

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

interface OrganizationFormDialogProps {
  organization: Organization | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrganizationFormDialog({
  organization,
  open,
  onOpenChange,
}: OrganizationFormDialogProps) {
  const createOrganization = useOrganizationCreate()
  const updateOrganization = useOrganizationUpdate()
  const isEditing = !!organization

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setName(organization?.name ?? "")
      setSlug(organization?.slug ?? "")
      setSlugTouched(false)
    }
  }, [open, organization])

  const isPending = createOrganization.isPending || updateOrganization.isPending

  const handleOpenChange = (next: boolean) => {
    if (isPending) return
    onOpenChange(next)
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isEditing && organization) {
      await updateOrganization.mutateAsync({ id: organization.id, name, slug })
    } else {
      await createOrganization.mutateAsync({ name, slug })
    }
    handleOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={isEditing ? "Editar organización" : "Nueva organización"}
      description={
        isEditing
          ? "Actualiza el nombre o el slug de la organización."
          : "Crea una organización vacía. Añade miembros después."
      }
      onSubmit={handleSubmit}
      isPending={isPending}
      submitLabel={isEditing ? "Guardar" : "Crear organización"}
    >
      <FormField label="Nombre" htmlFor="org-name">
        <Input
          id="org-name"
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </FormField>
      <FormField label="Slug" htmlFor="org-slug">
        <Input
          id="org-slug"
          required
          pattern="[a-z0-9-]+"
          className={textVariants({ role: "data" })}
          value={slug}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(e.target.value)
          }}
        />
      </FormField>
    </FormDialog>
  )
}
