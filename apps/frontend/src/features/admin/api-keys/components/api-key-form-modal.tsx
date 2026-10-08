import type { SyntheticEvent } from "react"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { useApiKeyCreate } from "@/features/admin/api-keys/hooks/use-api-keys"
import { useDialogForm } from "@/hooks/use-dialog-form"

const EXPIRATION_OPTIONS = [
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "180", label: "180 días" },
  { value: "365", label: "365 días" },
  { value: "never", label: "Sin caducidad" },
] as const

interface ApiKeyFormValues {
  name: string
  expiresIn: string
}

const emptyValues: ApiKeyFormValues = { name: "", expiresIn: "30" }

const fields: DialogFieldDescriptor<ApiKeyFormValues>[] = [
  {
    kind: "text",
    key: "name",
    label: "Nombre (opcional)",
    placeholder: "Ej. Integración con CRM",
  },
  {
    kind: "select",
    key: "expiresIn",
    label: "Caducidad",
    options: EXPIRATION_OPTIONS.map((option) => ({ ...option })),
  },
]

export type ApiKeyFormModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Called once the create mutation resolves with the freshly generated key.
   * The page uses this to open the "API key created" dialog with the full
   * value, since it will not be retrievable again.
   */
  onCreated?: (fullKey: string) => void
}

export function ApiKeyFormModal({
  open,
  onOpenChange,
  onCreated,
}: ApiKeyFormModalProps) {
  const createApiKey = useApiKeyCreate()
  const form = useDialogForm(open, emptyValues)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { name, expiresIn } = form.trimmed()
    const days = Number.parseInt(expiresIn, 10)
    const expiresInSeconds =
      expiresIn === "never" || !Number.isFinite(days)
        ? undefined
        : days * 24 * 60 * 60

    const created = await createApiKey.mutateAsync({
      name: name || undefined,
      expiresIn: expiresInSeconds,
    })
    onOpenChange(false)
    if (created?.key && onCreated) {
      onCreated(created.key)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva API key"
      description="Genera una nueva clave para acceder a la API."
      onSubmit={handleSubmit}
      isPending={createApiKey.isPending}
      submitLabel="Crear API key"
      form={form}
      fields={fields}
    />
  )
}
