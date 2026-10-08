import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { useUserMutations } from "@/features/admin/users/hooks/use-user-mutations"
import { useDialogForm } from "@/hooks/use-dialog-form"

interface BanUserFormValues {
  reason: string
}

const emptyValues: BanUserFormValues = { reason: "" }

const fields: DialogFieldDescriptor<BanUserFormValues>[] = [
  {
    kind: "text",
    key: "reason",
    label: "Motivo (opcional)",
    placeholder: "Incumplimiento de las normas",
  },
]

interface BanUserDialogProps {
  userId: string | null
  userLabel?: string
  onOpenChange: (open: boolean) => void
}

export function BanUserDialog({
  userId,
  userLabel,
  onOpenChange,
}: BanUserDialogProps) {
  const { banUser } = useUserMutations()
  const open = !!userId
  const form = useDialogForm(open, emptyValues)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userId) return
    const { reason } = form.trimmed()
    await banUser.mutateAsync({ userId, banReason: reason || undefined })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Banear usuario"
      description={
        userLabel
          ? `${userLabel} no podrá iniciar sesión mientras esté baneado.`
          : "El usuario no podrá iniciar sesión mientras esté baneado."
      }
      onSubmit={handleSubmit}
      isPending={banUser.isPending}
      submitLabel="Banear"
      submitVariant="destructive"
      form={form}
      fields={fields}
    />
  )
}
