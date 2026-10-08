import { getIcon } from "@/lib/icon-registry"

const DocumentIcon = getIcon("navigation", "documents")

import type { PDFDocumentProxy } from "pdfjs-dist"
import { useEffect, useRef, useState } from "react"
import { Rubric } from "@/components/shared/brand/rubric"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useDocumentPreviewFile,
  usePdfDocument,
} from "@/features/documents/shared"
import { cn } from "@/lib/utils"

// A thumbnail never needs more pixels than a sharp card on a 2x screen.
const MAX_RENDER_WIDTH = 640

/** Starts `true` once the element comes within a screen of the viewport. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || near) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true)
      },
      { rootMargin: "400px 0px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [near])

  return { ref, near }
}

function FirstPage({ pdf }: { pdf: PDFDocumentProxy }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const frame = canvas?.parentElement
    if (!canvas || !frame) return
    let cancelled = false
    const render = async () => {
      const page = await pdf.getPage(1)
      const base = page.getViewport({ scale: 1 })
      const target = Math.min(
        frame.clientWidth * window.devicePixelRatio,
        MAX_RENDER_WIDTH
      )
      const viewport = page.getViewport({ scale: target / base.width })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvas, viewport }).promise
      if (!cancelled) setRendered(true)
    }
    render().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pdf])

  return (
    <>
      {!rendered ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : null}
      <canvas
        ref={canvasRef}
        className={cn(
          "block h-auto w-full transition-opacity duration-300",
          rendered ? "opacity-100" : "opacity-0"
        )}
      />
    </>
  )
}

function Unavailable() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/60">
      <DocumentIcon className="size-8" />
    </div>
  )
}

interface DocumentThumbnailProps {
  documentId: string
  signed: boolean
  className?: string
}

/**
 * The document's first page as a sheet of paper, rendered with pdf.js once
 * it scrolls near the viewport. A signed document carries the rubric in its
 * corner, the way a signed page carries its signature.
 */
export function DocumentThumbnail({
  documentId,
  signed,
  className,
}: DocumentThumbnailProps) {
  const { ref, near } = useNearViewport<HTMLDivElement>()
  const { data: file, isError } = useDocumentPreviewFile(documentId, near)
  const pdf = usePdfDocument(file)

  const failed = isError || pdf.status === "error"

  return (
    <div
      ref={ref}
      className={cn(
        "relative aspect-[1/1.414] w-full overflow-hidden rounded-sm bg-white shadow-sheet",
        className
      )}
    >
      {failed ? <Unavailable /> : null}
      {!failed && pdf.status === "ready" ? <FirstPage pdf={pdf.pdf} /> : null}
      {!failed && pdf.status === "loading" ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : null}
      {signed ? (
        <Rubric className="absolute right-[6%] bottom-[4%] w-[24%] drop-shadow-[0_0_4px_white]" />
      ) : null}
    </div>
  )
}
