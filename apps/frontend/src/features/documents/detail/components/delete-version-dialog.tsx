import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  type DocumentVersion,
  documentLabels,
  useDocumentVersionDelete,
} from "@/features/documents/shared"

interface DeleteVersionDialogProps {
  documentId: string
  /** The current version to delete; null keeps the dialog closed. */
  version: DocumentVersion | null
  /** The version that becomes current again. */
  previous: DocumentVersion | undefined
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

/**
 * Confirms deleting the current version. A signed version gets a warning that
 * the signed file goes while the signature record and its trace stay. On
 * failure the dialog stays open and the API's message shows in a toast.
 */
export function DeleteVersionDialog({
  documentId,
  version,
  previous,
  onOpenChange,
  onDeleted,
}: DeleteVersionDialogProps) {
  const deleteVersion = useDocumentVersionDelete(documentId)

  const confirm = async () => {
    if (!version) return false
    try {
      await deleteVersion.mutateAsync({ versionId: version.id })
    } catch {
      return false
    }
    onDeleted()
    return true
  }

  return (
    <ConfirmDialog
      open={version !== null && previous !== undefined}
      onOpenChange={onOpenChange}
      title={documentLabels.deleteVersionTitle(version?.number ?? 0)}
      description={
        <DeleteVersionDescription version={version} previous={previous} />
      }
      confirmLabel={documentLabels.deleteVersion}
      variant="destructive"
      onConfirm={confirm}
    />
  )
}

function DeleteVersionDescription({
  version,
  previous,
}: Pick<DeleteVersionDialogProps, "version" | "previous">) {
  if (!version || !previous) return null
  return (
    <>
      <span className="block">
        {documentLabels.deleteVersionDescription(
          version.number,
          previous.number
        )}
      </span>
      {version.kind === "signature" ? (
        <span className="mt-2 block">
          {documentLabels.deleteSignedVersionWarning}
        </span>
      ) : null}
    </>
  )
}
