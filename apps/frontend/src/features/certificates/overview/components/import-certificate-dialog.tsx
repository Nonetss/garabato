import { getIcon } from "@/lib/icon-registry"

const CertificateIcon = getIcon("navigation", "certificates")

import { type SyntheticEvent, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import {
  type DialogFieldDescriptor,
  DialogFields,
} from "@/components/shared/form/dialog-fields"
import { FormField } from "@/components/shared/form/field-label"
import { FileDropField } from "@/components/shared/form/file-drop-field"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { certificateLabels } from "@/features/certificates/overview/definitions/certificate-labels"
import { useCertificateImport } from "@/features/certificates/overview/hooks/use-certificates"
import {
  errorMessage,
  optionalText,
} from "@/features/certificates/overview/model/form"
import { useDialogForm } from "@/hooks/use-dialog-form"
import { useOnOpen } from "@/hooks/use-on-open"

/** Mirrors the API cap; real PKCS#12 files are 5–20 KiB. */
const MAX_P12_BYTES = 100 * 1024
const FILE_INPUT_ID = "certificate-import-file"

interface ImportValues {
  password: string
  alias: string
  rememberPassword: boolean
}

const emptyValues: ImportValues = {
  password: "",
  alias: "",
  rememberPassword: false,
}

const fields: DialogFieldDescriptor<ImportValues>[] = [
  {
    kind: "password",
    key: "password",
    label: certificateLabels.password,
    autoComplete: "off",
  },
  {
    kind: "text",
    key: "alias",
    label: certificateLabels.alias,
    hint: certificateLabels.aliasHint,
    maxLength: 100,
  },
  {
    kind: "checkbox",
    key: "rememberPassword",
    label: certificateLabels.rememberPassword,
    description: certificateLabels.rememberPasswordDescription,
    hint: certificateLabels.rememberPasswordHint,
  },
]

interface ImportCertificateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportCertificateDialog({
  open,
  onOpenChange,
}: ImportCertificateDialogProps) {
  const importCertificate = useCertificateImport()
  const form = useDialogForm(open, emptyValues)
  const [file, setFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useOnOpen(open, () => {
    setFile(null)
    setSubmitError(null)
  })

  // The password must not linger in memory once the dialog is gone.
  const handleOpenChange = (next: boolean) => {
    if (importCertificate.isPending) return
    if (!next) {
      form.reset()
      setFile(null)
    }
    onOpenChange(next)
  }

  const handleFileChange = (next: File | null) => {
    setFile(next)
    setSubmitError(null)
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      setSubmitError(certificateLabels.fileRequired)
      return
    }
    if (file.size > MAX_P12_BYTES) {
      setSubmitError(certificateLabels.fileTooLarge)
      return
    }
    // Passwords are sent exactly as typed: spaces can be part of them.
    const { password, alias, rememberPassword } = form.values
    try {
      await importCertificate.mutateAsync({
        file,
        password,
        alias: optionalText(alias),
        rememberPassword,
      })
    } catch (error) {
      setSubmitError(errorMessage(error))
      return
    }
    handleOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={certificateLabels.import}
      description={certificateLabels.importDescription}
      onSubmit={handleSubmit}
      isPending={importCertificate.isPending}
      submitLabel={certificateLabels.importSubmit}
    >
      <FormField label={certificateLabels.file} htmlFor={FILE_INPUT_ID}>
        <FileDropField
          id={FILE_INPUT_ID}
          accept=".p12,.pfx,application/x-pkcs12"
          file={file}
          onFileChange={handleFileChange}
          prompt={certificateLabels.filePrompt}
          requirements={certificateLabels.fileRequirements}
          fileIcon={CertificateIcon}
          disabled={importCertificate.isPending}
        />
      </FormField>
      <DialogFields form={form} fields={fields} />
      {submitError ? (
        <Text as="p" variant="compact" tone="destructive" role="alert">
          {submitError}
        </Text>
      ) : null}
    </FormDialog>
  )
}
