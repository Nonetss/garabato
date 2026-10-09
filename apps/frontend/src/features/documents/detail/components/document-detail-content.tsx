import { getIcon } from "@/lib/icon-registry"

const DocumentIcon = getIcon("navigation", "documents")
const DownloadIcon = getIcon("actions", "download")
const SignIcon = getIcon("actions", "sign")
const EditPagesIcon = getIcon("actions", "editPages")

import { useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { StatusTag } from "@/components/shared/data-display/status-dot"
import { Hint } from "@/components/shared/feedback/hint"
import { StateCard } from "@/components/shared/feedback/state-card"
import { IconButton } from "@/components/shared/form/icon-button"
import { PageHero } from "@/components/shared/layout/page-hero"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DeleteVersionDialog } from "@/features/documents/detail/components/delete-version-dialog"
import {
  DocumentOrganizationMenu,
  DocumentPlacement,
} from "@/features/documents/detail/components/document-organization"
import { DocumentStatusTag } from "@/features/documents/detail/components/document-status-tag"
import { PageEditor } from "@/features/documents/detail/components/page-editor"
import {
  PdfViewer,
  type StampPlacement,
} from "@/features/documents/detail/components/pdf-viewer"
import { SignPanel } from "@/features/documents/detail/components/sign-panel"
import { SignatureHistory } from "@/features/documents/detail/components/signature-history"
import { SignatureValidation } from "@/features/documents/detail/components/signature-validation"
import { VersionList } from "@/features/documents/detail/components/version-list"
import { useEmbeddedSignatureCount } from "@/features/documents/detail/hooks/use-signature-validation"
import {
  previousVersion,
  shownVersion,
  versionParamCodec,
  viewedVersionNumber,
} from "@/features/documents/detail/model/version-view"
import {
  type DocumentSummary,
  type DocumentVersion,
  documentFacts,
  documentLabels,
  documentSigningStatus,
  downloadDocumentVersion,
  saveFile,
  useDocument,
  useDocumentFile,
  usePdfDocument,
  versionKindLabels,
} from "@/features/documents/shared"
import { useIsMobile } from "@/hooks/use-mobile"
import { flagCodec, useQueryParam } from "@/hooks/use-query-param"
import { joinFacts } from "@/lib/format"
import { notifyError } from "@/lib/toast"

function download(documentId: string, versionNumber?: number) {
  downloadDocumentVersion(documentId, versionNumber)
    .then(saveFile)
    .catch((error: Error) =>
      notifyError("No se pudo descargar el documento", error.message)
    )
}

function ViewerState({ documentId }: { documentId: string }) {
  return (
    <StateCard
      icon={<DocumentIcon className="size-6" />}
      title="No se pudo mostrar el PDF"
      description="Puedes descargarlo y abrirlo con tu visor de PDF."
      tone="destructive"
      action={
        <Button variant="outline" onClick={() => download(documentId)}>
          Descargar
        </Button>
      }
    />
  )
}

/** The hero's status: the embedded signatures count once there is a
 *  version to check. */
function SigningStatus({
  document,
  versionId,
}: {
  document: Pick<DocumentSummary, "id" | "signatureCount">
  versionId: string | undefined
}) {
  if (versionId) {
    return <DocumentStatusTag document={document} versionId={versionId} />
  }
  const status = documentSigningStatus(document)
  return <StatusTag dotTone={status.tone}>{status.label}</StatusTag>
}

/**
 * Opens the page editor. Disabled while the file is loading, and, with a
 * hint saying why, when the document carries signatures (made here or
 * embedded in the current version), since rewriting would invalidate them.
 */
function EditPagesAction({
  document,
  versionId,
  ready,
  compact,
  onEdit,
}: {
  document: Pick<DocumentSummary, "id" | "signatureCount">
  versionId: string
  ready: boolean
  compact: boolean
  onEdit: () => void
}) {
  const embeddedSignatures = useEmbeddedSignatureCount(document.id, versionId)
  const signed = document.signatureCount > 0 || embeddedSignatures > 0
  if (compact) {
    // Touch never shows the bubble; the disabled look says enough there.
    const hint = signed
      ? documentLabels.editPagesSigned
      : documentLabels.editPages
    return (
      <IconButton
        variant="outline"
        size="icon"
        label={hint}
        accessibleLabel={documentLabels.editPages}
        icon={EditPagesIcon}
        disabled={signed || !ready}
        focusableWhenDisabled={signed}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={onEdit}
      />
    )
  }
  const button = (
    <Button
      variant="outline"
      disabled={signed || !ready}
      // Keeps the hint reachable by hover and keyboard while disabled.
      focusableWhenDisabled={signed}
      className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={onEdit}
    >
      <EditPagesIcon className="size-4" />
      {documentLabels.editPages}
    </Button>
  )
  if (!signed) return button
  return <Hint label={documentLabels.editPagesSigned}>{button}</Hint>
}

/** Icon-only on narrow viewports (named with `Hint`), labelled from `md`. */
function DownloadAction({
  compact,
  onClick,
}: {
  compact: boolean
  onClick: () => void
}) {
  if (compact) {
    return (
      <IconButton
        variant="outline"
        size="icon"
        label={documentLabels.download}
        icon={DownloadIcon}
        onClick={onClick}
      />
    )
  }
  return (
    <Button variant="outline" onClick={onClick}>
      <DownloadIcon className="size-4" />
      {documentLabels.download}
    </Button>
  )
}

/** Says which earlier version the viewer shows and offers the current one. */
function VersionNotice({
  version,
  onBack,
}: {
  version: DocumentVersion
  onBack: () => void
}) {
  const label = joinFacts([
    `versión ${version.number}`,
    versionKindLabels[version.kind],
  ])
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-3 py-2 sm:px-6 xl:px-8">
      <Text as="p" variant="compact" role="status">
        {documentLabels.viewingVersion(label)}
      </Text>
      <Button variant="outline" size="sm" onClick={onBack}>
        {documentLabels.viewCurrent}
      </Button>
    </div>
  )
}

// Signing acts on the current version, so the viewer shows that one.
function viewRequestOf(signing: boolean, requested: number | null) {
  if (signing) return null
  return requested
}

export function DocumentDetailContent({ documentId }: { documentId: string }) {
  const {
    data: document,
    isPending,
    isError,
    refetch,
  } = useDocument(documentId)
  // `?firmar=1` opens signing straight away (the home's drop zone links here).
  const [signing, setSigning] = useQueryParam("firmar", false, flagCodec)
  // `?version=2` shows an earlier version; absent, the current one.
  const [requestedVersion, setRequestedVersion] = useQueryParam(
    "version",
    null,
    versionParamCodec
  )
  const viewRequest = viewRequestOf(signing, requestedVersion)
  const { data: file, isFetching: fileFetching } = useDocumentFile(
    documentId,
    viewedVersionNumber(document?.versions, viewRequest)
  )
  const pdf = usePdfDocument(file)
  // Right after the shown version changes, the previous file's pdf is still
  // `ready`; only a pdf parsed from this file shows this version.
  const pdfMatchesFile = pdf.status === "ready" && pdf.file === file
  const [editingPages, setEditingPages] = useState(false)
  const [deletingVersion, setDeletingVersion] =
    useState<DocumentVersion | null>(null)
  const compact = useIsMobile()
  const [signBar, setSignBar] = useState<HTMLDivElement | null>(null)

  const [visible, setVisible] = useState(true)
  const [stamp, setStamp] = useState<StampPlacement | null>(null)

  const showCurrent = () => setRequestedVersion(null)

  const closeSigning = () => {
    setSigning(false)
    setStamp(null)
  }

  if (isError) {
    return (
      <StateCard
        icon={<DocumentIcon className="size-6" />}
        title="No se pudo cargar el documento"
        description="Puede que no exista o que no sea tuyo."
        tone="destructive"
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        }
      />
    )
  }

  if (isPending) {
    return <Skeleton className="h-96 w-full" />
  }

  const placing = signing && visible
  const currentVersion = document.versions.at(-1)
  const shown = shownVersion(document.versions, viewRequest)
  const viewingCurrent = shown === currentVersion

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Below `lg` the whole page scrolls inside this pane; from `lg` it is
          pinned and only the PDF (and the side panel, if it overflows)
          scroll. */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto lg:overflow-hidden">
        <PageHero
          icon={<DocumentIcon className="size-5" />}
          title={document.name}
          description={
            <span className="tabular-nums">{documentFacts(document)}</span>
          }
          status={
            <SigningStatus document={document} versionId={currentVersion?.id} />
          }
          action={
            <div className="flex gap-2">
              <DownloadAction
                compact={compact}
                onClick={() =>
                  download(
                    document.id,
                    viewedVersionNumber(document.versions, viewRequest)
                  )
                }
              />
              {!signing && currentVersion ? (
                <EditPagesAction
                  document={document}
                  versionId={currentVersion.id}
                  ready={pdf.status === "ready" && !fileFetching}
                  compact={compact}
                  onEdit={() => {
                    showCurrent()
                    setEditingPages(true)
                  }}
                />
              ) : null}
              {signing ? null : (
                <Button
                  onClick={() => {
                    showCurrent()
                    setSigning(true)
                  }}
                >
                  <SignIcon className="size-4" />
                  Firmar
                </Button>
              )}
              <DocumentOrganizationMenu document={document} />
            </div>
          }
        >
          <DocumentPlacement document={document} />
        </PageHero>

        {/* One column below `lg`, ordered signing → PDF → history: the side
            column dissolves (`contents`) so signing can come first. */}
        <div className="flex flex-col gap-6 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="order-2 flex min-w-0 flex-col rounded-lg bg-desk lg:order-0 lg:min-h-0 lg:overflow-hidden">
            {shown && !viewingCurrent ? (
              <VersionNotice version={shown} onBack={showCurrent} />
            ) : null}
            {pdf.status === "error" ? (
              <div className="p-3 sm:p-6 xl:p-8">
                <ViewerState documentId={document.id} />
              </div>
            ) : null}
            {pdf.status === "loading" ? (
              <div className="p-3 sm:p-6 xl:p-8">
                <Skeleton className="aspect-[1/1.414] w-full rounded-sm" />
              </div>
            ) : null}
            {pdf.status === "ready" ? (
              <PdfViewer
                pdf={pdf.pdf}
                placing={placing}
                stamp={stamp}
                onDraw={(page, rect) =>
                  setStamp({ page, rect, pages: stamp?.pages ?? "one" })
                }
              />
            ) : null}
          </div>

          <div className="contents lg:block lg:space-y-6 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            {signing ? (
              <section className="order-1 space-y-4 rounded-xl border bg-card/40 p-4 lg:order-0">
                <Text as="h2" variant="headline">
                  Firmar documento
                </Text>
                <SignPanel
                  document={document}
                  stamp={stamp}
                  onVisibilityChange={setVisible}
                  onPagesChange={(pages) => {
                    if (stamp) setStamp({ ...stamp, pages })
                  }}
                  onSigned={closeSigning}
                  onCancel={closeSigning}
                  barSlot={signBar}
                />
              </section>
            ) : null}
            <aside className="order-3 space-y-6 lg:order-0">
              <section className="space-y-3">
                <SectionHeading
                  title="Versiones"
                  count={document.versions.length}
                />
                <VersionList
                  versions={document.versions}
                  shownId={shown?.id}
                  onShow={(version: DocumentVersion) => {
                    // The current version is the default: no param for it.
                    if (version === currentVersion) showCurrent()
                    else setRequestedVersion(version.number)
                  }}
                  onDownload={(version: DocumentVersion) =>
                    download(document.id, version.number)
                  }
                  onDelete={setDeletingVersion}
                />
              </section>
              <section className="space-y-3">
                <SectionHeading
                  title="Firmas"
                  count={document.signatures.length}
                />
                {currentVersion ? (
                  <SignatureHistory
                    records={document.signatures}
                    documentId={document.id}
                    versionId={currentVersion.id}
                  />
                ) : null}
              </section>
              {shown ? (
                <section className="space-y-3">
                  <SectionHeading title="Validez de las firmas" />
                  <SignatureValidation
                    documentId={document.id}
                    versionId={shown.id}
                  />
                </section>
              ) : null}
            </aside>
          </div>
        </div>
      </div>

      {signing ? <div ref={setSignBar} className="shrink-0 lg:hidden" /> : null}

      {/* Only once the viewer holds the current version's pages: opening the
          editor from an earlier version first brings the viewer back. */}
      {pdf.status === "ready" &&
      pdfMatchesFile &&
      viewingCurrent &&
      currentVersion ? (
        <PageEditor
          open={editingPages}
          onOpenChange={setEditingPages}
          pdf={pdf.pdf}
          documentId={document.id}
          baseVersionId={currentVersion.id}
        />
      ) : null}

      <DeleteVersionDialog
        documentId={document.id}
        version={deletingVersion}
        previous={previousVersion(document.versions)}
        onOpenChange={(open) => {
          if (!open) setDeletingVersion(null)
        }}
        onDeleted={showCurrent}
      />
    </div>
  )
}
