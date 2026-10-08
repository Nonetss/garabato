import { getIcon } from "@/lib/icon-registry"

const DocumentIcon = getIcon("navigation", "documents")
const DownloadIcon = getIcon("actions", "download")
const SignIcon = getIcon("actions", "sign")

import { useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { StateCard } from "@/components/shared/feedback/state-card"
import { PageHero } from "@/components/shared/layout/page-hero"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PdfViewer,
  type StampPlacement,
} from "@/features/documents/detail/components/pdf-viewer"
import { SignPanel } from "@/features/documents/detail/components/sign-panel"
import { SignatureHistory } from "@/features/documents/detail/components/signature-history"
import { VersionList } from "@/features/documents/detail/components/version-list"
import {
  type DocumentVersion,
  downloadDocumentVersion,
  saveFile,
  useDocument,
  useDocumentFile,
  usePdfDocument,
} from "@/features/documents/shared"
import { flagCodec, useQueryParam } from "@/hooks/use-query-param"
import { formatFileSize } from "@/lib/format"
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

export function DocumentDetailContent({ documentId }: { documentId: string }) {
  const {
    data: document,
    isPending,
    isError,
    refetch,
  } = useDocument(documentId)
  const { data: file } = useDocumentFile(documentId)
  const pdf = usePdfDocument(file)

  // `?firmar=1` opens signing straight away (the home's drop zone links here).
  const [signing, setSigning] = useQueryParam("firmar", false, flagCodec)
  const [visible, setVisible] = useState(true)
  const [stamp, setStamp] = useState<StampPlacement | null>(null)

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

  return (
    // Below `lg` the whole page scrolls inside this root; from `lg` it is
    // pinned and only the PDF (and the side panel, if it overflows) scroll.
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto lg:overflow-hidden">
      <PageHero
        icon={<DocumentIcon className="size-5" />}
        title={document.name}
        description={`${document.pageCount} páginas · ${formatFileSize(document.sizeBytes)} · ${document.signatureCount} firmas`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => download(document.id)}>
              <DownloadIcon className="size-4" />
              Descargar
            </Button>
            {signing ? null : (
              <Button onClick={() => setSigning(true)}>
                <SignIcon className="size-4" />
                Firmar
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 overscroll-contain rounded-lg bg-desk p-3 sm:p-6 lg:overflow-y-auto xl:p-8">
          {pdf.status === "error" ? (
            <ViewerState documentId={document.id} />
          ) : null}
          {pdf.status === "loading" ? (
            <Skeleton className="aspect-[1/1.414] w-full rounded-sm" />
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

        <aside className="space-y-6 overscroll-contain lg:overflow-y-auto lg:pr-1">
          {signing ? (
            <section className="space-y-4 rounded-xl border bg-card/40 p-4">
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
              />
            </section>
          ) : null}
          <section className="space-y-3">
            <SectionHeading
              title="Versiones"
              count={document.versions.length}
            />
            <VersionList
              versions={document.versions}
              onDownload={(version: DocumentVersion) =>
                download(document.id, version.number)
              }
            />
          </section>
          <section className="space-y-3">
            <SectionHeading title="Firmas" count={document.signatures.length} />
            <SignatureHistory records={document.signatures} />
          </section>
        </aside>
      </div>
    </div>
  )
}
