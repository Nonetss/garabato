import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { useUserMutations } from "@/features/admin/users/hooks/use-user-mutations"
import { useDialogForm } from "@/hooks/use-dialog-form"

interface CreateUserFormValues {
  name: string
  email: string
  password: string
  role: "user" | "admin"
}

const emptyValues: CreateUserFormValues = {
  name: "",
  email: "",
  password: "",
  role: "user",
}

const fields: DialogFieldDescriptor<CreateUserFormValues>[] = [
  { kind: "text", key: "name", label: "Nombre", required: true },
  { kind: "email", key: "email", label: "Email", required: true },
  {
    kind: "password",
    key: "password",
    label: "Contraseña",
    required: true,
    minLength: 8,
  },
  {
    kind: "select",
    key: "role",
    label: "Rol",
    options: [
      { value: "user", label: "Usuario" },
      { value: "admin", label: "Administrador" },
    ],
  },
]

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateUserDialog({
  open,
  onOpenChange,
}: CreateUserDialogProps) {
  const { createUser } = useUserMutations()
  const form = useDialogForm(open, emptyValues)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    await createUser.mutateAsync(form.trimmed())
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo usuario"
      description="Crea una cuenta e indica su contraseña inicial."
      onSubmit={handleSubmit}
      isPending={createUser.isPending}
      submitLabel="Crear usuario"
      form={form}
      fields={fields}
    />
  )
}
