import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { useUpdateName } from "@/features/profile/overview/hooks/use-profile-mutations"
import { useDialogForm } from "@/hooks/use-dialog-form"

interface EditNameFormValues {
  name: string
}

const fields: DialogFieldDescriptor<EditNameFormValues>[] = [
  { kind: "text", key: "name", label: "Nombre", required: true },
]

interface EditNameDialogProps {
  open: boolean
  currentName: string
  onOpenChange: (open: boolean) => void
}

export function EditNameDialog({
  open,
  currentName,
  onOpenChange,
}: EditNameDialogProps) {
  const updateName = useUpdateName()
  const form = useDialogForm(open, { name: "" }, { name: currentName })

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    await updateName.mutateAsync({ name: form.trimmed().name })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar nombre"
      description="Este es el nombre que verán otros usuarios."
      onSubmit={handleSubmit}
      isPending={updateName.isPending}
      submitDisabled={!form.values.name.trim()}
      submitLabel="Guardar"
      form={form}
      fields={fields}
    />
  )
}
