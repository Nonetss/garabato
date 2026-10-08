import { getIcon } from "@/lib/icon-registry"

const DocumentIcon = getIcon("navigation", "documents")
const UploadIcon = getIcon("actions", "upload")

import { useState } from "react"
import {
  SegmentedPicker,
  type SegmentedPickerOption,
} from "@/components/shared/form/segmented-picker"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { EntityList } from "@/components/shared/resource/entity-list"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DocumentGrid } from "@/features/documents/overview/components/document-grid"
import { RenameDocumentDialog } from "@/features/documents/overview/components/rename-document-dialog"
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
import { type QueryParamCodec, useQueryParam } from "@/hooks/use-query-param"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { useTargetDialog } from "@/hooks/use-target-dialog"
import { notifyError } from "@/lib/toast"

type DocumentsView = "grid" | "list"

const viewOptions: readonly SegmentedPickerOption<DocumentsView>[] = [
  { value: "grid", label: "Miniaturas" },
  { value: "list", label: "Lista" },
]

// `?vista=lista` keeps the list across reloads; the thumbnails are the default.
const viewCodec: QueryParamCodec<DocumentsView> = {
  parse: (raw) => {
    if (raw === "lista") return "list"
    return "grid"
  },
  serialize: (value) => {
    if (value === "list") return "lista"
    return "miniaturas"
  },
}

export function DocumentsContent() {
  const { data: documents = [], isPending, isError, refetch } = useDocuments()
  const deleteDocument = useDocumentDelete()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [view, setView] = useQueryParam<DocumentsView>(
    "vista",
    "grid",
    viewCodec
  )

  const renameDialog = useTargetDialog<DocumentSummary>()
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
    onRename: renameDialog.open,
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
        heroAction={uploadButton}
        heroChildren={
          // The library's ledger line: what is on the desk and how it is
          // laid out, ruled off from the sheets below.
          documents.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b pb-4">
              <HeroCount
                segments={[
                  { count: signedCount, label: "firmados" },
                  { count: documents.length, label: "total" },
                ]}
              />
              <div className="w-44">
                <SegmentedPicker
                  label="Vista"
                  options={viewOptions}
                  value={view}
                  onChange={setView}
                  columns={2}
                />
              </div>
            </div>
          ) : null
        }
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
        {(data) => {
          if (view === "list") {
            return (
              <EntityList
                items={data}
                context={rowContext}
                definition={documentDefinition}
              />
            )
          }
          return <DocumentGrid documents={data} context={rowContext} />
        }}
      </ResourceOverview>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <RenameDocumentDialog
        document={renameDialog.target}
        {...renameDialog.dialogProps}
      />
      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
