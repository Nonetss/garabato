import { type ChangeEvent, type SyntheticEvent, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Input } from "@/components/ui/input"
import { documentLabels, useDocumentUpload } from "@/features/documents/shared"
import { useOnOpen } from "@/hooks/use-on-open"

/** Mirrors the API cap. */
const MAX_PDF_BYTES = 20 * 1024 * 1024
const FILE_INPUT_ID = "document-upload-file"

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Ha ocurrido un error inesperado"
}

interface UploadDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
}: UploadDocumentDialogProps) {
  const upload = useDocumentUpload()
  const [file, setFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useOnOpen(open, () => {
    setFile(null)
    setSubmitError(null)
  })

  const handleOpenChange = (next: boolean) => {
    if (upload.isPending) return
    onOpenChange(next)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
    setSubmitError(null)
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      setSubmitError(documentLabels.fileRequired)
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      setSubmitError(documentLabels.fileTooLarge)
      return
    }
    try {
      await upload.mutateAsync({ file })
    } catch (error) {
      setSubmitError(errorMessage(error))
      return
    }
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={documentLabels.upload}
      description={documentLabels.uploadDescription}
      onSubmit={handleSubmit}
      isPending={upload.isPending}
      submitLabel={documentLabels.uploadSubmit}
    >
      <FormField label={documentLabels.file} htmlFor={FILE_INPUT_ID}>
        <Input
          id={FILE_INPUT_ID}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
        />
      </FormField>
      {submitError ? (
        <Text as="p" variant="compact" tone="destructive" role="alert">
          {submitError}
        </Text>
      ) : null}
    </FormDialog>
  )
}
