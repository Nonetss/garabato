import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { useUserMutations } from "@/features/admin/users/hooks/use-user-mutations"
import { useDialogForm } from "@/hooks/use-dialog-form"

interface ChangePasswordFormValues {
  password: string
}

const emptyValues: ChangePasswordFormValues = { password: "" }

const fields: DialogFieldDescriptor<ChangePasswordFormValues>[] = [
  {
    kind: "password",
    key: "password",
    label: "Nueva contraseña",
    required: true,
    minLength: 8,
  },
]

interface ChangePasswordDialogProps {
  userId: string | null
  userLabel?: string
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({
  userId,
  userLabel,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const { setUserPassword } = useUserMutations()
  const open = !!userId
  const form = useDialogForm(open, emptyValues)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userId) return
    await setUserPassword.mutateAsync({
      userId,
      newPassword: form.trimmed().password,
    })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cambiar contraseña"
      description={
        userLabel
          ? `Establece una nueva contraseña para ${userLabel}.`
          : "Establece una nueva contraseña."
      }
      onSubmit={handleSubmit}
      isPending={setUserPassword.isPending}
      submitLabel="Guardar"
      form={form}
      fields={fields}
    />
  )
}
