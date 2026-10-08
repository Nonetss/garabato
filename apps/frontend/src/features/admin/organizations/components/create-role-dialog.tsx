import type { SyntheticEvent } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { permissionMatrix } from "@/features/admin/organizations/definitions/role-options"
import { useRoleCreate } from "@/features/admin/organizations/hooks/use-organization-detail"
import { useDialogForm } from "@/hooks/use-dialog-form"
import { cn } from "@/lib/utils"

interface CreateRoleFormValues {
  name: string
  permission: Record<string, string[]>
}

const emptyValues: CreateRoleFormValues = { name: "", permission: {} }

const fields: DialogFieldDescriptor<CreateRoleFormValues>[] = [
  {
    kind: "text",
    key: "name",
    label: "Nombre del rol",
    required: true,
    placeholder: "ej. soporte",
  },
]

interface CreateRoleDialogProps {
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateRoleDialog({
  organizationId,
  open,
  onOpenChange,
}: CreateRoleDialogProps) {
  const { mutateAsync, isPending } = useRoleCreate(organizationId)
  const form = useDialogForm(open, emptyValues)

  const toggleAction = (resource: string, action: string, checked: boolean) => {
    const actions = form.values.permission[resource] ?? []
    const next = checked
      ? [...actions, action]
      : actions.filter((a) => a !== action)
    form.set("permission", { ...form.values.permission, [resource]: next })
  }

  const hasAnyPermission = Object.values(form.values.permission).some(
    (actions) => actions.length > 0
  )

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { name, permission } = form.trimmed()
    await mutateAsync({ organizationId, role: name, permission })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo rol"
      description="Define un nombre y los permisos de este rol en la organización."
      onSubmit={handleSubmit}
      isPending={isPending}
      submitDisabled={!hasAnyPermission}
      submitLabel="Crear rol"
      className="sm:max-w-xl"
      form={form}
      fields={fields}
    >
      <div className="space-y-4 border-t pt-4">
        <Text as="p" variant="label" tone="muted">
          Permisos
        </Text>
        {permissionMatrix.map(({ resource, label, actions }) => (
          <div key={resource} className="space-y-2">
            <Text as="p" variant="label" tone="muted">
              {label}
            </Text>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {actions.map((action) => {
                const checked =
                  form.values.permission[resource]?.includes(action.value) ??
                  false
                const id = `role-perm-${resource}-${action.value}`
                return (
                  <div key={action.value} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      className="size-5"
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleAction(resource, action.value, value === true)
                      }
                    />
                    <Label
                      htmlFor={id}
                      className={cn(
                        textVariants({ role: "compact" }),
                        "font-normal"
                      )}
                    >
                      {action.label}
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </FormDialog>
  )
}
