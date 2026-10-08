import type { PDFDocumentProxy } from "pdfjs-dist"
import { type PointerEvent, useEffect, useRef, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { Skeleton } from "@/components/ui/skeleton"
import { PdfPageNav } from "@/features/documents/detail/components/pdf-page-nav"
import {
  CURRENT_PAGE_PROBE,
  clampPageIndex,
  currentPageIndex,
} from "@/features/documents/detail/model/page-nav"
import {
  isUsableRect,
  type PagePoint,
  pointIn,
  rectBetween,
  rectStyle,
} from "@/features/documents/detail/model/placement"
import type { StampRect } from "@/features/documents/shared"
import { cn } from "@/lib/utils"

/** Where the stamp goes, as chosen so far. */
export type StampPlacement = {
  page: number
  pages: "one" | "all"
  rect: StampRect
}

interface PdfViewerProps {
  pdf: PDFDocumentProxy
  /** When true, dragging on a page draws the stamp rectangle. */
  placing: boolean
  stamp: StampPlacement | null
  onDraw: (page: number, rect: StampRect) => void
}

// Room left above a page scrolled to by the page controls, matching the gap
// between pages.
const PAGE_SCROLL_OFFSET = 24

// Renders at the displayed width times the device pixel ratio, capped so a
// zoomed-out page doesn't allocate a huge canvas.
const MAX_RENDER_WIDTH = 2000

// The rectangle to draw on this page: the one being dragged, else the chosen
// stamp when it shows on this page.
function shownRect(
  draft: StampRect | null,
  stamp: StampPlacement | null,
  index: number
) {
  if (draft) return draft
  if (!stamp) return null
  if (stamp.pages === "all" || stamp.page === index) return stamp.rect
  return null
}

/**
 * The nearest ancestor that scrolls vertically, so lazy pages preload against
 * the pane they scroll in (the viewer column, or the page root on narrow
 * screens) rather than the window, which doesn't scroll on this page.
 */
function scrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent)
    if (overflowY === "auto" || overflowY === "scroll") return parent
    parent = parent.parentElement
  }
  return null
}

function aspectStyle(aspect: number | null) {
  if (aspect === null) return undefined
  return { aspectRatio: `1 / ${aspect}` }
}

function PdfPage({
  pdf,
  index,
  placing,
  stamp,
  onDraw,
}: PdfViewerProps & { index: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [aspect, setAspect] = useState<number | null>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [dragStart, setDragStart] = useState<PagePoint | null>(null)
  const [draft, setDraft] = useState<StampRect | null>(null)

  // Page proportions first, so the list keeps its height before rendering.
  useEffect(() => {
    let cancelled = false
    pdf.getPage(index + 1).then((page) => {
      const viewport = page.getViewport({ scale: 1 })
      if (!cancelled) setAspect(viewport.height / viewport.width)
    })
    return () => {
      cancelled = true
    }
  }, [pdf, index])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true)
      },
      { root: scrollParent(element), rootMargin: "600px 0px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!visible || !canvas || !container) return
    let cancelled = false
    const render = async () => {
      const page = await pdf.getPage(index + 1)
      const base = page.getViewport({ scale: 1 })
      const target = Math.min(
        container.clientWidth * window.devicePixelRatio,
        MAX_RENDER_WIDTH
      )
      const viewport = page.getViewport({ scale: target / base.width })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const task = page.render({ canvas, viewport })
      await task.promise
      if (!cancelled) setRendered(true)
    }
    render().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pdf, index, visible])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!placing) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const start = pointIn(
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
      event.clientY
    )
    setDragStart(start)
    setDraft(rectBetween(start, start))
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return
    const point = pointIn(
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
      event.clientY
    )
    setDraft(rectBetween(dragStart, point))
  }

  const handlePointerUp = () => {
    if (draft && isUsableRect(draft)) onDraw(index, draft)
    setDragStart(null)
    setDraft(null)
  }

  const shown = shownRect(draft, stamp, index)

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-sm bg-white shadow-sheet"
        style={aspectStyle(aspect)}
      >
        {!rendered ? (
          <Skeleton className="absolute inset-0 rounded-none" />
        ) : null}
        <canvas ref={canvasRef} className="block h-auto w-full" />
        <div
          className={cn(
            "absolute inset-0 touch-none",
            placing && "cursor-crosshair"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {shown ? (
            <div
              className="absolute rounded-sm border-2 border-primary bg-primary/10"
              style={rectStyle(shown)}
            />
          ) : null}
        </div>
      </div>
      <Text as="p" variant="meta-sm" tone="muted" className="text-center">
        Página {index + 1} de {pdf.numPages}
      </Text>
    </div>
  )
}

function pageElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"))
}

/**
 * Renders every page of a PDF lazily, with the stamp placement overlay and a
 * bottom bar to jump between pages. Fills a flex column frame.
 */
export function PdfViewer(props: PdfViewerProps) {
  const count = props.pdf.numPages
  const pages = Array.from({ length: count }, (_, index) => index)
  const rootRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  // Tracks the page being read from whichever pane scrolls the viewer (it
  // changes with the breakpoint), so listen to every scroll in capture phase.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = () => {
      const pane = scrollParent(root)
      if (!pane) return
      const paneTop = pane.getBoundingClientRect().top
      const tops = pageElements(root).map(
        (page) => page.getBoundingClientRect().top - paneTop
      )
      const atEnd = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 1
      setCurrent(
        currentPageIndex(tops, pane.clientHeight * CURRENT_PAGE_PROBE, atEnd)
      )
    }
    update()
    const options = { capture: true, passive: true }
    document.addEventListener("scroll", update, options)
    window.addEventListener("resize", update)
    return () => {
      document.removeEventListener("scroll", update, options)
      window.removeEventListener("resize", update)
    }
  }, [])

  const goTo = (index: number) => {
    const root = rootRef.current
    if (!root) return
    const pane = scrollParent(root)
    const page = pageElements(root)[clampPageIndex(index, count)]
    if (!pane || !page) return
    const offset =
      page.getBoundingClientRect().top - pane.getBoundingClientRect().top
    pane.scrollTo({
      top: pane.scrollTop + offset - PAGE_SCROLL_OFFSET,
      behavior: "smooth",
    })
  }

  // From `lg` the pages scroll in their own pane above the page controls;
  // below it the whole route scrolls and the controls stick to its bottom.
  return (
    <>
      <div className="min-h-0 flex-1 overscroll-contain p-3 sm:p-6 lg:overflow-y-auto xl:p-8">
        <div ref={rootRef} className="mx-auto max-w-4xl space-y-6">
          {pages.map((index) => (
            <div key={index} data-pdf-page>
              <PdfPage {...props} index={index} />
            </div>
          ))}
        </div>
      </div>
      {count > 1 ? (
        <PdfPageNav current={current} count={count} onGoTo={goTo} />
      ) : null}
    </>
  )
}
