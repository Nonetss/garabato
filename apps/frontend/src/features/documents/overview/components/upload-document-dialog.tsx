import { getIcon } from "@/lib/icon-registry"

const DocumentIcon = getIcon("navigation", "documents")

import { type SyntheticEvent, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { FormField } from "@/components/shared/form/field-label"
import { FileDropField } from "@/components/shared/form/file-drop-field"
import { FormDialog } from "@/components/shared/form/form-dialog"
import {
  documentLabels,
  pdfFileProblem,
  useDocumentUpload,
} from "@/features/documents/shared"
import { useFinePointer } from "@/hooks/use-fine-pointer"
import { useOnOpen } from "@/hooks/use-on-open"

const FILE_INPUT_ID = "document-upload-file"

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Ha ocurrido un error inesperado"
}

interface UploadDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Folder the new document goes into; the library root when null. */
  folderId: string | null
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  folderId,
}: UploadDocumentDialogProps) {
  const upload = useDocumentUpload()
  const [file, setFile] = useState<File | null>(null)
  const fine = useFinePointer()
  const prompt = fine
    ? documentLabels.filePrompt
    : documentLabels.filePromptTouch
  const [submitError, setSubmitError] = useState<string | null>(null)

  useOnOpen(open, () => {
    setFile(null)
    setSubmitError(null)
  })

  const handleOpenChange = (next: boolean) => {
    if (upload.isPending) return
    onOpenChange(next)
  }

  const handleFileChange = (next: File | null) => {
    setFile(next)
    setSubmitError(null)
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      setSubmitError(documentLabels.fileRequired)
      return
    }
    const problem = pdfFileProblem(file)
    if (problem === "not-pdf") {
      setSubmitError(documentLabels.fileNotPdf)
      return
    }
    if (problem === "too-large") {
      setSubmitError(documentLabels.fileTooLarge)
      return
    }
    try {
      await upload.mutateAsync({
        file,
        ...(folderId !== null && { folderId }),
      })
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
        <FileDropField
          id={FILE_INPUT_ID}
          accept=".pdf,application/pdf"
          file={file}
          onFileChange={handleFileChange}
          prompt={prompt}
          requirements={documentLabels.fileRequirements}
          fileIcon={DocumentIcon}
          disabled={upload.isPending}
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
