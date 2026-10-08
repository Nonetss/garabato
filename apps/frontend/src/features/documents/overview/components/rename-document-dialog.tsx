import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import {
  type DocumentSummary,
  documentLabels,
  useDocumentRename,
} from "@/features/documents/shared"
import { useDialogForm } from "@/hooks/use-dialog-form"

interface RenameValues {
  name: string
}

const PDF_EXTENSION = /\.pdf$/i

// The API keeps names under 200 characters including `.pdf`.
const fields: DialogFieldDescriptor<RenameValues>[] = [
  {
    kind: "text",
    key: "name",
    label: documentLabels.name,
    hint: documentLabels.nameHint,
    required: true,
    autoFocus: true,
    maxLength: 196,
  },
]

interface RenameDocumentDialogProps {
  document: DocumentSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Edits a document's name without its `.pdf` extension, which is kept. */
export function RenameDocumentDialog({
  document,
  open,
  onOpenChange,
}: RenameDocumentDialogProps) {
  const rename = useDocumentRename()
  const form = useDialogForm(
    open,
    { name: "" },
    { name: document?.name.replace(PDF_EXTENSION, "") ?? "" }
  )

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!document) return
    const base = form.trimmed().name.replace(PDF_EXTENSION, "")
    await rename.mutateAsync({ id: document.id, name: `${base}.pdf` })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={documentLabels.renameTitle}
      onSubmit={handleSubmit}
      isPending={rename.isPending}
      submitDisabled={!form.values.name.replace(PDF_EXTENSION, "").trim()}
      submitLabel={documentLabels.save}
      form={form}
      fields={fields}
    />
  )
}
