import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { certificateLabels } from "@/features/certificates/overview/definitions/certificate-labels"
import { useCertificateRememberPassword } from "@/features/certificates/overview/hooks/use-certificates"
import { errorMessage } from "@/features/certificates/overview/model/form"
import type { Certificate } from "@/features/certificates/overview/model/types"
import { useDialogForm } from "@/hooks/use-dialog-form"

interface RememberPasswordValues {
  password: string
}

const fields: DialogFieldDescriptor<RememberPasswordValues>[] = [
  {
    kind: "password",
    key: "password",
    label: certificateLabels.password,
    required: true,
    autoFocus: true,
    autoComplete: "off",
  },
]

interface RememberPasswordDialogProps {
  certificate: Certificate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RememberPasswordDialog({
  certificate,
  open,
  onOpenChange,
}: RememberPasswordDialogProps) {
  const rememberPassword = useCertificateRememberPassword()
  const form = useDialogForm(open, { password: "" })

  const handleOpenChange = (next: boolean) => {
    if (rememberPassword.isPending) return
    if (!next) form.reset()
    onOpenChange(next)
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!certificate) return
    try {
      // Sent exactly as typed: spaces can be part of a password.
      await rememberPassword.mutateAsync({
        id: certificate.id,
        password: form.values.password,
      })
    } catch (error) {
      form.setError("password", errorMessage(error))
      return
    }
    handleOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={certificateLabels.rememberTitle}
      description={certificateLabels.rememberDescription}
      onSubmit={handleSubmit}
      isPending={rememberPassword.isPending}
      submitDisabled={!form.values.password}
      submitLabel={certificateLabels.save}
      form={form}
      fields={fields}
    />
  )
}
