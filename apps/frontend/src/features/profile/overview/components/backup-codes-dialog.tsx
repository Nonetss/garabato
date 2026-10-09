import { type SyntheticEvent, useState } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { BackupCodesList } from "@/features/profile/overview/components/backup-codes-list"
import { useRegenerateBackupCodes } from "@/features/profile/overview/hooks/use-two-factor"
import { useDialogForm } from "@/hooks/use-dialog-form"
import { useOnOpen } from "@/hooks/use-on-open"

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

interface BackupCodesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Generates a new set of backup codes after confirming the password. */
export function BackupCodesDialog({
  open,
  onOpenChange,
}: BackupCodesDialogProps) {
  const regenerate = useRegenerateBackupCodes()
  const form = useDialogForm(open, emptyValues)
  const [codes, setCodes] = useState<string[] | null>(null)

  useOnOpen(open, () => setCodes(null))

  const submitPassword = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const result = await regenerate.mutateAsync({
      password: form.values.password,
    })
    setCodes(result.backupCodes)
  }

  const close = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    onOpenChange(false)
  }

  if (!codes) {
    return (
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Nuevos códigos de respaldo"
        description="Confirma tu contraseña. Los códigos que tengas ahora dejarán de servir."
        onSubmit={submitPassword}
        isPending={regenerate.isPending}
        submitLabel="Generar"
        form={form}
        fields={fields}
      />
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevos códigos de respaldo"
      onSubmit={close}
      submitLabel="Hecho"
    >
      <BackupCodesList codes={codes} />
    </FormDialog>
  )
}
