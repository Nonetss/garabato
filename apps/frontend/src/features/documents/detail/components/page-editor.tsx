import { getIcon } from "@/lib/icon-registry"

const MoveBeforeIcon = getIcon("actions", "moveBefore")
const MoveAfterIcon = getIcon("actions", "moveAfter")
const RotateLeftIcon = getIcon("actions", "rotateLeft")
const RotateRightIcon = getIcon("actions", "rotateRight")
const RemoveIcon = getIcon("actions", "delete")
const RestoreIcon = getIcon("actions", "restore")

import type { PDFDocumentProxy } from "pdfjs-dist"
import { type DragEvent, useEffect, useRef, useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { IconButton } from "@/components/shared/form/icon-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { usePageEditor } from "@/features/documents/detail/hooks/use-page-editor"
import type { EditorPage } from "@/features/documents/detail/model/page-editor"
import {
  documentLabels,
  type PageRotation,
  useDocumentEditPages,
} from "@/features/documents/shared"
import { useFinePointer } from "@/hooks/use-fine-pointer"
import { useOnOpen } from "@/hooks/use-on-open"
import { cn } from "@/lib/utils"

// Device pixels along the page's longer side: sharp in a ~180px tile at 2x.
const THUMBNAIL_PIXELS = 360

// Rotation is a CSS transform, so turning a page never re-renders it.
const rotationClass: Record<PageRotation, string> = {
  0: "rotate-0",
  90: "rotate-90",
  180: "rotate-180",
  270: "rotate-270",
}

/** Renders one page once its tile comes near the visible area. */
function PageThumbnail({
  pdf,
  pageNumber,
  rotation,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  rotation: PageRotation
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || near) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true)
      },
      { rootMargin: "300px 0px" }
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [near])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!near || !canvas) return
    let cancelled = false
    const render = async () => {
      const page = await pdf.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const scale = THUMBNAIL_PIXELS / Math.max(base.width, base.height)
      const viewport = page.getViewport({ scale })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvas, viewport }).promise
      if (!cancelled) setRendered(true)
    }
    render().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pdf, pageNumber, near])

  return (
    <div
      ref={frameRef}
      className="relative flex aspect-square items-center justify-center p-3"
    >
      {!rendered ? <Skeleton className="absolute inset-3 rounded-sm" /> : null}
      <canvas
        ref={canvasRef}
        className={cn(
          "block max-h-full max-w-full bg-white shadow-sheet",
          rotationClass[rotation],
          rendered ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  )
}

interface PageTileProps {
  pdf: PDFDocumentProxy
  page: EditorPage
  position: number
  total: number
  /** Native drag only on fine pointers; touch reorders with the buttons. */
  draggable: boolean
  dropTarget: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onDrop: () => void
  onDragEnd: () => void
  onMove: (to: number) => void
  onRotate: (direction: "left" | "right") => void
  onToggleRemove: () => void
}

function PageTile({
  pdf,
  page,
  position,
  total,
  draggable,
  dropTarget,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  onMove,
  onRotate,
  onToggleRemove,
}: PageTileProps) {
  const number = page.source + 1
  const label = (action: string) => documentLabels.pageAction(action, number)

  const handleDragStart = (event: DragEvent<HTMLLIElement>) => {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(position))
    onDragStart()
  }
  const handleDragOver = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }
  const handleDrop = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault()
    onDrop()
  }

  return (
    // A row (thumbnail beside its controls) in a narrow editor, a tile
    // from `@md`.
    <li
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnter={onDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "flex rounded-lg border bg-desk @md:flex-col",
        draggable && "cursor-grab active:cursor-grabbing",
        dropTarget && "border-primary ring-2 ring-primary/30"
      )}
    >
      <div
        className={cn(
          "w-28 shrink-0 @md:w-auto",
          page.removed && "opacity-35 grayscale"
        )}
      >
        <PageThumbnail pdf={pdf} pageNumber={number} rotation={page.rotation} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 border-l py-1.5 @md:gap-0 @md:border-t @md:border-l-0 @md:py-0">
        <div className="flex items-center justify-between gap-2 px-2 @md:pt-1.5">
          <Text variant="meta" className="tabular-nums">
            {documentLabels.pageNumber(number)}
          </Text>
          {page.removed ? (
            <Text variant="status" tone="destructive">
              {documentLabels.pageRemoved}
            </Text>
          ) : null}
        </div>
        <div className="grid grid-cols-5 justify-items-center px-1 @md:flex @md:flex-wrap @md:items-center @md:gap-0.5 @md:pb-1">
          <IconButton
            label={documentLabels.moveBefore}
            accessibleLabel={label(documentLabels.moveBefore)}
            icon={MoveBeforeIcon}
            disabled={position === 0}
            onClick={() => onMove(position - 1)}
          />
          <IconButton
            label={documentLabels.moveAfter}
            accessibleLabel={label(documentLabels.moveAfter)}
            icon={MoveAfterIcon}
            disabled={position === total - 1}
            onClick={() => onMove(position + 1)}
          />
          <IconButton
            label={documentLabels.rotateLeft}
            accessibleLabel={label(documentLabels.rotateLeft)}
            icon={RotateLeftIcon}
            disabled={page.removed}
            onClick={() => onRotate("left")}
          />
          <IconButton
            label={documentLabels.rotateRight}
            accessibleLabel={label(documentLabels.rotateRight)}
            icon={RotateRightIcon}
            disabled={page.removed}
            onClick={() => onRotate("right")}
          />
          <RemoveToggle
            removed={page.removed}
            label={label}
            onClick={onToggleRemove}
          />
        </div>
      </div>
    </li>
  )
}

function RemoveToggle({
  removed,
  label,
  onClick,
}: {
  removed: boolean
  label: (action: string) => string
  onClick: () => void
}) {
  if (removed) {
    return (
      <IconButton
        label={documentLabels.restorePage}
        accessibleLabel={label(documentLabels.restorePage)}
        icon={RestoreIcon}
        className="@md:ml-auto"
        onClick={onClick}
      />
    )
  }
  return (
    <IconButton
      label={documentLabels.removePage}
      accessibleLabel={label(documentLabels.removePage)}
      icon={RemoveIcon}
      className="text-destructive hover:text-destructive @md:ml-auto"
      onClick={onClick}
    />
  )
}

function SummaryLine({
  summary,
}: {
  summary: { pageCount: number; removed: number; rotated: number }
}) {
  if (summary.pageCount === 0) {
    return (
      <Text variant="meta" tone="destructive">
        {documentLabels.noPagesLeft}
      </Text>
    )
  }
  return (
    <Text
      variant="meta"
      tone="muted"
      aria-live="polite"
      className="tabular-nums"
    >
      {documentLabels.pageSummary(
        summary.pageCount,
        summary.removed,
        summary.rotated
      )}
    </Text>
  )
}

interface PageEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdf: PDFDocumentProxy
  documentId: string
  /** The version being edited: the current one when the editor opened. */
  baseVersionId: string
}

/**
 * Reorders, rotates and removes the pages of the current version, saved as
 * the next version. Thumbnails render lazily from the viewer's pdf.js
 * document; dragging a tile or its move buttons reorder it.
 */
export function PageEditor({
  open,
  onOpenChange,
  pdf,
  documentId,
  baseVersionId,
}: PageEditorProps) {
  const editor = usePageEditor(pdf.numPages)
  const editPages = useDocumentEditPages(documentId)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const fine = useFinePointer()

  useOnOpen(open, editor.reset)

  // Closing forgets the last error, so the next opening starts clean.
  const handleOpenChange = (next: boolean) => {
    if (!next) editPages.reset()
    onOpenChange(next)
  }

  const endDrag = () => {
    setDragFrom(null)
    setDragOver(null)
  }

  const save = () => {
    editPages.mutate(
      { documentId, baseVersionId, pages: editor.requestPages() },
      { onSuccess: () => handleOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="gap-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>{documentLabels.editPagesTitle}</DialogTitle>
          <DialogDescription
            className={cn(textVariants({ role: "compact" }), "leading-relaxed")}
          >
            {documentLabels.editPagesDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="@container min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <ol className="grid gap-3 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5">
            {editor.pages.map((page, position) => (
              <PageTile
                key={page.source}
                pdf={pdf}
                page={page}
                position={position}
                total={editor.pages.length}
                draggable={fine}
                dropTarget={dragFrom !== null && dragOver === position}
                onDragStart={() => setDragFrom(position)}
                onDragEnter={() => setDragOver(position)}
                onDrop={() => {
                  if (dragFrom !== null) editor.move(dragFrom, position)
                  endDrag()
                }}
                onDragEnd={endDrag}
                onMove={(to) => editor.move(position, to)}
                onRotate={(direction) => editor.rotate(position, direction)}
                onToggleRemove={() => editor.toggleRemove(position)}
              />
            ))}
          </ol>
        </div>

        <DialogFooter className="flex-col border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <SummaryLine summary={editor.summary} />
            {editPages.error ? (
              <Text variant="meta" tone="destructive" role="alert">
                {editPages.error.message}
              </Text>
            ) : null}
          </div>
          <div className="flex gap-2 *:flex-1 sm:*:flex-none">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={editPages.isPending}
            >
              {documentLabels.cancel}
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={editPages.isPending || !editor.canSave}
            >
              {editPages.isPending ? <Spinner decorative /> : null}
              {documentLabels.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
