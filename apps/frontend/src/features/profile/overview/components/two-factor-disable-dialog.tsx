import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { useDisableTwoFactor } from "@/features/profile/overview/hooks/use-two-factor"
import { useDialogForm } from "@/hooks/use-dialog-form"

interface PasswordValues {
  password: string
}

const emptyValues: PasswordValues = { password: "" }

const fields: DialogFieldDescriptor<PasswordValues>[] = [
  {
    kind: "password",
    key: "password",
    label: "Contraseña",
    required: true,
    autoComplete: "current-password",
    autoFocus: true,
  },
]

interface TwoFactorDisableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TwoFactorDisableDialog({
  open,
  onOpenChange,
}: TwoFactorDisableDialogProps) {
  const disable = useDisableTwoFactor()
  const form = useDialogForm(open, emptyValues)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    await disable.mutateAsync({ password: form.values.password })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Desactivar verificación en dos pasos"
      description="Para entrar bastará con tu email y tu contraseña. Tus códigos de respaldo dejarán de servir."
      onSubmit={handleSubmit}
      isPending={disable.isPending}
      submitLabel="Desactivar"
      submitVariant="destructive"
      form={form}
      fields={fields}
    />
  )
}
