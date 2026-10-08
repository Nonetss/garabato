import { getIcon } from "@/lib/icon-registry"

const DocumentIcon = getIcon("navigation", "documents")
const UploadIcon = getIcon("actions", "upload")

import { useState } from "react"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { EntityList } from "@/components/shared/resource/entity-list"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { UploadDocumentDialog } from "@/features/documents/overview/components/upload-document-dialog"
import {
  type DocumentsRowContext,
  documentDefinition,
} from "@/features/documents/overview/definitions/document.definition"
import {
  type DocumentSummary,
  documentLabels,
  downloadDocumentVersion,
  saveFile,
  useDocumentDelete,
  useDocuments,
} from "@/features/documents/shared"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { notifyError } from "@/lib/toast"

export function DocumentsContent() {
  const { data: documents = [], isPending, isError, refetch } = useDocuments()
  const deleteDocument = useDocumentDelete()
  const [uploadOpen, setUploadOpen] = useState(false)

  const deleteDialog = useTargetConfirmDialog<DocumentSummary>({
    title: documentLabels.deleteTitle,
    description: (document) => documentLabels.deleteDescription(document.name),
    confirmLabel: documentLabels.delete,
    onConfirm: (document) => deleteDocument.mutateAsync({ id: document.id }),
  })

  const signedCount = documents.filter(
    (document) => document.signatureCount > 0
  ).length

  const rowContext: DocumentsRowContext = {
    onDownload: (document) => {
      downloadDocumentVersion(document.id)
        .then(saveFile)
        .catch((error: Error) =>
          notifyError("No se pudo descargar el documento", error.message)
        )
    },
    onDelete: deleteDialog.open,
  }

  const uploadButton = (
    <Button onClick={() => setUploadOpen(true)}>
      <UploadIcon className="size-4" />
      {documentLabels.upload}
    </Button>
  )

  return (
    <>
      <ResourceOverview
        surface="documents"
        heroMeta={
          <HeroCount
            segments={[
              { count: signedCount, label: "firmados" },
              { count: documents.length, label: "total" },
            ]}
          />
        }
        heroAction={uploadButton}
        query={{ data: documents, isPending, isError, refetch }}
        loading="Cargando documentos..."
        error={{
          icon: <DocumentIcon className="size-6" />,
          title: "No se pudieron cargar los documentos",
          description:
            "Comprueba tu conexión; si el problema continúa, inténtalo de nuevo más tarde.",
        }}
        isEmpty={(data) => data.length === 0}
        empty={{
          icon: <DocumentIcon className="size-6" />,
          title: "Todavía no tienes documentos",
          description: "Sube un PDF para firmarlo con uno de tus certificados.",
          action: uploadButton,
        }}
      >
        {(data) => (
          <EntityList
            items={data}
            context={rowContext}
            definition={documentDefinition}
          />
        )}
      </ResourceOverview>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
