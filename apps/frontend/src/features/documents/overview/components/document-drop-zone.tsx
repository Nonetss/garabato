import { getIcon } from "@/lib/icon-registry"

const UploadIcon = getIcon("actions", "upload")

import { type ChangeEvent, type DragEvent, useRef, useState } from "react"
import { Rubric } from "@/components/shared/brand/rubric"
import { Text } from "@/components/shared/brand/typography"
import { Button } from "@/components/ui/button"
import {
  documentLabels,
  type PdfFileProblem,
  pdfFileProblem,
  useDocumentUpload,
} from "@/features/documents/shared"
import { useFinePointer } from "@/hooks/use-fine-pointer"
import { getAppSurface } from "@/lib/app-surfaces"
import { navigate } from "@/lib/navigate"
import { cn } from "@/lib/utils"

const FILE_INPUT_ID = "document-drop-zone-file"

function problemMessage(problem: PdfFileProblem) {
  if (problem === "not-pdf") return documentLabels.fileNotPdf
  return documentLabels.fileTooLarge
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Ha ocurrido un error inesperado"
}

// A phone has nothing to drop: there the sheet asks to pick a file.
function idleTitle(fine: boolean) {
  if (fine) return documentLabels.dropTitle
  return documentLabels.dropTitleTouch
}

/** The document's page with signing already open (`?firmar=1`). */
function signingHref(documentId: string) {
  return `${getAppSurface("documents").path}/${documentId}?firmar=1`
}

/**
 * A blank sheet to drop a PDF on (or pick one with the button). The file is
 * checked, uploaded, and the visitor lands on the new document with signing
 * open. While the upload runs, the rubric keeps writing.
 */
export function DocumentDropZone({ className }: { className?: string }) {
  const upload = useDocumentUpload()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploadingName, setUploadingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const busy = uploadingName !== null
  const fine = useFinePointer()

  const start = async (file: File | undefined) => {
    if (!file || busy) return
    const problem = pdfFileProblem(file)
    if (problem !== null) {
      setError(problemMessage(problem))
      return
    }
    setError(null)
    setUploadingName(file.name)
    try {
      const document = await upload.mutateAsync({ file })
      navigate(signingHref(document.id))
    } catch (uploadError) {
      setError(errorMessage(uploadError))
      setUploadingName(null)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (busy) return
    event.dataTransfer.dropEffect = "copy"
    setDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    void start(event.dataTransfer.files[0])
  }

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    void start(event.target.files?.[0])
    // Let the same file be picked again after an error.
    event.target.value = ""
  }

  const rubricMotion = busy ? "loop" : "write"
  const headline = dragging ? documentLabels.dropActive : idleTitle(fine)

  return (
    <section
      aria-labelledby="document-drop-zone-title"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "@container flex flex-col rounded-lg bg-background p-2.5 shadow-sheet",
        className
      )}
    >
      <div
        className={cn(
          "flex min-h-72 flex-1 flex-col items-center justify-center gap-5 rounded-md border-[1.5px] border-dashed px-4 py-8 text-center transition-colors duration-200 @md:min-h-96 @md:gap-6 @md:px-6 @md:py-14",
          dragging ? "border-primary/60 bg-primary/5" : "border-border"
        )}
      >
        <Rubric
          key={rubricMotion}
          motion={rubricMotion}
          className="w-24 @md:w-36"
        />

        <div className="flex max-w-md flex-col items-center gap-2">
          <Text
            as="h1"
            id="document-drop-zone-title"
            variant="display"
            className="text-balance @md:text-3xl"
          >
            {headline}
          </Text>
          {uploadingName !== null ? (
            <Text as="p" variant="meta" tone="muted" aria-live="polite">
              {documentLabels.dropUploading(uploadingName)}
            </Text>
          ) : (
            <Text as="p" variant="meta" tone="muted" className="text-pretty">
              {documentLabels.dropDescription}
            </Text>
          )}
        </div>

        <input
          ref={inputRef}
          id={FILE_INPUT_ID}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={handlePick}
        />
        <Button
          size="lg"
          disabled={busy}
          className="w-full max-w-xs @md:w-auto"
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon className="size-4" />
          {documentLabels.dropChoose}
        </Button>

        {error ? (
          <Text as="p" variant="compact" tone="destructive" role="alert">
            {error}
          </Text>
        ) : null}
      </div>
    </section>
  )
}
