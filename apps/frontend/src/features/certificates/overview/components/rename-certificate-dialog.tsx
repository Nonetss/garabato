import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { certificateLabels } from "@/features/certificates/overview/definitions/certificate-labels"
import { useCertificateRename } from "@/features/certificates/overview/hooks/use-certificates"
import type { Certificate } from "@/features/certificates/overview/model/types"
import { useDialogForm } from "@/hooks/use-dialog-form"

interface RenameValues {
  alias: string
}

const fields: DialogFieldDescriptor<RenameValues>[] = [
  {
    kind: "text",
    key: "alias",
    label: certificateLabels.alias,
    required: true,
    autoFocus: true,
    maxLength: 100,
  },
]

interface RenameCertificateDialogProps {
  certificate: Certificate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RenameCertificateDialog({
  certificate,
  open,
  onOpenChange,
}: RenameCertificateDialogProps) {
  const rename = useCertificateRename()
  const form = useDialogForm(
    open,
    { alias: "" },
    { alias: certificate?.alias ?? "" }
  )

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!certificate) return
    await rename.mutateAsync({
      id: certificate.id,
      alias: form.trimmed().alias,
    })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={certificateLabels.renameTitle}
      onSubmit={handleSubmit}
      isPending={rename.isPending}
      submitDisabled={!form.values.alias.trim()}
      submitLabel={certificateLabels.save}
      form={form}
      fields={fields}
    />
  )
}
