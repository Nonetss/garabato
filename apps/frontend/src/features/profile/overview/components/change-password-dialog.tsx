import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { useChangePassword } from "@/features/profile/overview/hooks/use-profile-mutations"
import { useDialogForm } from "@/hooks/use-dialog-form"

interface ChangePasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const emptyValues: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
}

const fields: DialogFieldDescriptor<ChangePasswordFormValues>[] = [
  {
    kind: "password",
    key: "currentPassword",
    label: "Contraseña actual",
    required: true,
    autoComplete: "current-password",
  },
  {
    kind: "password",
    key: "newPassword",
    label: "Nueva contraseña",
    required: true,
    minLength: 8,
    autoComplete: "new-password",
  },
  {
    kind: "password",
    key: "confirmPassword",
    label: "Confirmar contraseña",
    required: true,
    minLength: 8,
    autoComplete: "new-password",
  },
]

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const changePassword = useChangePassword()
  const form = useDialogForm(open, emptyValues)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { currentPassword, newPassword, confirmPassword } = form.trimmed()

    if (newPassword !== confirmPassword) {
      form.setError("confirmPassword", "Las contraseñas no coinciden")
      return
    }

    await changePassword.mutateAsync({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cambiar contraseña"
      description="Se cerrará la sesión en tus otros dispositivos."
      onSubmit={handleSubmit}
      isPending={changePassword.isPending}
      submitLabel="Guardar"
      form={form}
      fields={fields}
    />
  )
}
