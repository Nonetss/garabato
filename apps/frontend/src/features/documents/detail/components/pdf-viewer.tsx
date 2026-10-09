import type { PDFDocumentProxy } from "pdfjs-dist"
import {
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { Text } from "@/components/shared/brand/typography"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { PdfPageNav } from "@/features/documents/detail/components/pdf-page-nav"
import { PdfZoomControls } from "@/features/documents/detail/components/pdf-zoom-controls"
import {
  CURRENT_PAGE_PROBE,
  clampPageIndex,
  currentPageIndex,
} from "@/features/documents/detail/model/page-nav"
import {
  isTap,
  isUsableRect,
  type PagePoint,
  pointIn,
  rectBetween,
  rectStyle,
  stampAt,
} from "@/features/documents/detail/model/placement"
import {
  anchorShift,
  FIT_ZOOM,
  type PageAnchor,
  pageAnchor,
  WHEEL_ZOOM_STEP,
  zoomIn,
  zoomOut,
} from "@/features/documents/detail/model/zoom"
import type { StampRect } from "@/features/documents/shared"
import { useFinePointer } from "@/hooks/use-fine-pointer"
import { cn } from "@/lib/utils"

/** Where the stamp goes, as chosen so far. */
export type StampPlacement = {
  page: number
  pages: "one" | "all"
  rect: StampRect
}

interface PdfViewerProps {
  pdf: PDFDocumentProxy
  /**
   * When true, dragging on a page draws the stamp rectangle (fine pointers)
   * or tapping it drops a standard stamp there (touch, which keeps scroll).
   */
  placing: boolean
  stamp: StampPlacement | null
  onDraw: (page: number, rect: StampRect) => void
}

// Room left above a page scrolled to by the page controls, matching the gap
// between pages.
const PAGE_SCROLL_OFFSET = 24

// Renders at the displayed width times the device pixel ratio, capped so a
// page doesn't allocate a huge canvas; a zoomed-in page wider than the cap
// still renders at its displayed width.
const MAX_RENDER_WIDTH = 2000

// The reading column's width at the fitted zoom, in rem (`max-w-4xl`).
const FIT_WIDTH_REM = 56

function renderWidth(displayed: number) {
  return Math.min(
    displayed * window.devicePixelRatio,
    Math.max(MAX_RENDER_WIDTH, displayed)
  )
}

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

function pointOf(event: PointerEvent<HTMLElement>) {
  return pointIn(
    event.currentTarget.getBoundingClientRect(),
    event.clientX,
    event.clientY
  )
}

// Height over width of the page as displayed.
function displayedAspect(element: HTMLElement) {
  const { width, height } = element.getBoundingClientRect()
  return height / width
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
  zoom,
}: PdfViewerProps & { index: number; zoom: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [aspect, setAspect] = useState<number | null>(null)
  const [near, setNear] = useState(false)
  const [rendered, setRendered] = useState(false)
  // The zoom the canvas was last drawn at; pages away from the pane keep it
  // (stretched) until they come near again.
  const renderedZoom = useRef<number | null>(null)
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
        if (entry) setNear(entry.isIntersecting)
      },
      { root: scrollParent(element), rootMargin: "600px 0px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!near || !canvas || !container) return
    if (renderedZoom.current === zoom) return
    let cancelled = false
    // Draws off screen and copies over, so the shown page never blanks while
    // a new zoom renders.
    const buffer = document.createElement("canvas")
    let cancelRender = () => {}
    const render = async () => {
      const page = await pdf.getPage(index + 1)
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      const target = renderWidth(container.clientWidth)
      const viewport = page.getViewport({ scale: target / base.width })
      buffer.width = Math.floor(viewport.width)
      buffer.height = Math.floor(viewport.height)
      const task = page.render({ canvas: buffer, viewport })
      cancelRender = () => task.cancel()
      await task.promise
      if (cancelled) return
      canvas.width = buffer.width
      canvas.height = buffer.height
      canvas.getContext("2d")?.drawImage(buffer, 0, 0)
      renderedZoom.current = zoom
      setRendered(true)
    }
    render().catch(() => undefined)
    return () => {
      cancelled = true
      cancelRender()
    }
  }, [pdf, index, near, zoom])

  const fine = useFinePointer()
  // Touch taps instead of dragging, so a swipe over the page still scrolls.
  const [tapStart, setTapStart] = useState<PagePoint | null>(null)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!placing) return
    const start = pointOf(event)
    if (!fine) {
      setTapStart(start)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragStart(start)
    setDraft(rectBetween(start, start))
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return
    setDraft(rectBetween(dragStart, pointOf(event)))
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (tapStart) {
      const end = pointOf(event)
      if (isTap(tapStart, end)) {
        onDraw(index, stampAt(end, displayedAspect(event.currentTarget)))
      }
      setTapStart(null)
      return
    }
    if (draft && isUsableRect(draft)) onDraw(index, draft)
    setDragStart(null)
    setDraft(null)
  }

  // The browser took the touch over for scrolling or zooming.
  const handlePointerCancel = () => {
    setTapStart(null)
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
            "absolute inset-0",
            placing && fine && "cursor-crosshair touch-none",
            // Pan and pinch stay; double-tap zoom goes, so a tap lands at once.
            placing && !fine && "touch-manipulation"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
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

// Each page's top edge relative to the pane's visible top, and its height.
function pageSpans(root: HTMLElement, pane: HTMLElement) {
  const paneTop = pane.getBoundingClientRect().top
  return pageElements(root).map((page) => {
    const { top, height } = page.getBoundingClientRect()
    return { top: top - paneTop, height }
  })
}

// Where a zoom is aimed, in viewport coordinates.
type ZoomFocus = { x: number; y: number }

/**
 * The point a zoom keeps in place: the page point under the focus line, and
 * how far across the frame's content the focus sits.
 */
type ZoomHold = {
  zoom: number
  anchor: PageAnchor
  line: number
  across: number
  offsetX: number
}

// The focus as a line down the pane and an offset across the frame, or
// their middles for the bar's buttons.
function focusOffsets(
  pane: HTMLElement,
  frame: HTMLElement,
  focus: ZoomFocus | null
) {
  if (!focus) {
    return { line: pane.clientHeight / 2, offsetX: frame.clientWidth / 2 }
  }
  return {
    line: focus.y - pane.getBoundingClientRect().top,
    offsetX: focus.x - frame.getBoundingClientRect().left,
  }
}

function zoomHold(
  root: HTMLElement,
  frame: HTMLElement,
  zoom: number,
  focus: ZoomFocus | null
): ZoomHold | null {
  const pane = scrollParent(root)
  if (!pane) return null
  const { line, offsetX } = focusOffsets(pane, frame, focus)
  const anchor = pageAnchor(pageSpans(root, pane), line)
  if (!anchor) return null
  const across = (frame.scrollLeft + offsetX) / frame.scrollWidth
  return { zoom, anchor, line, across, offsetX }
}

function restoreHold(root: HTMLElement, frame: HTMLElement, hold: ZoomHold) {
  frame.scrollLeft = hold.across * frame.scrollWidth - hold.offsetX
  const pane = scrollParent(root)
  if (!pane) return
  const span = pageSpans(root, pane)[hold.anchor.page]
  if (!span) return
  pane.scrollTop += anchorShift(span, hold.anchor.fraction, hold.line)
}

// The reading column grows with the zoom; past the pane's width it scrolls
// sideways.
function zoomedWidth(zoom: number) {
  return { width: `${zoom * 100}%`, maxWidth: `${zoom * FIT_WIDTH_REM}rem` }
}

/**
 * Renders every page of a PDF lazily, with the stamp placement overlay and a
 * bottom bar to jump between pages and zoom. Fills a flex column frame.
 */
export function PdfViewer(props: PdfViewerProps) {
  const count = props.pdf.numPages
  const pages = Array.from({ length: count }, (_, index) => index)
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const [zoom, setZoom] = useState(FIT_ZOOM)
  const hold = useRef<ZoomHold | null>(null)

  // Tracks the page being read from whichever pane scrolls the viewer (it
  // changes with the breakpoint), so listen to every scroll in capture phase.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = () => {
      const pane = scrollParent(root)
      if (!pane) return
      const tops = pageSpans(root, pane).map((span) => span.top)
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

  // Once the pages take their new size, scrolls the held point back in place.
  useLayoutEffect(() => {
    const held = hold.current
    const root = rootRef.current
    const frame = frameRef.current
    if (!held || held.zoom !== zoom || !root || !frame) return
    hold.current = null
    restoreHold(root, frame, held)
  }, [zoom])

  const applyZoom = (next: number, focus: ZoomFocus | null) => {
    const root = rootRef.current
    const frame = frameRef.current
    if (next === zoom || !root || !frame) return
    hold.current = zoomHold(root, frame, next, focus)
    setZoom(next)
  }

  // Ctrl+wheel (and a trackpad pinch, which the browser reports as one)
  // zooms the pages around the pointer instead of the whole app.
  useEffect(() => {
    const root = rootRef.current
    const frame = frameRef.current
    if (!root || !frame) return
    let delta = 0
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      delta += event.deltaY
      if (Math.abs(delta) < WHEEL_ZOOM_STEP) return
      const next = delta < 0 ? zoomIn(zoom) : zoomOut(zoom)
      delta = 0
      if (next === zoom) return
      const focus = { x: event.clientX, y: event.clientY }
      hold.current = zoomHold(root, frame, next, focus)
      setZoom(next)
    }
    frame.addEventListener("wheel", onWheel, { passive: false })
    return () => frame.removeEventListener("wheel", onWheel)
  }, [zoom])

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

  // From `lg` the pages scroll in their own pane above the bottom bar; below
  // it the whole route scrolls and the bar sticks to its bottom. The frame
  // always scrolls sideways for a zoomed-in page; below `lg` its vertical
  // overflow is `hidden` (it never clips: the frame is as tall as its pages)
  // so `scrollParent` skips it for the route pane.
  return (
    <>
      <div
        ref={frameRef}
        className="min-h-0 flex-none overflow-x-auto overflow-y-hidden overscroll-contain p-3 sm:p-6 lg:flex-1 lg:overflow-y-auto xl:p-8"
      >
        <div
          ref={rootRef}
          className="mx-auto space-y-6"
          style={zoomedWidth(zoom)}
        >
          {pages.map((index) => (
            <div key={index} data-pdf-page>
              <PdfPage {...props} index={index} zoom={zoom} />
            </div>
          ))}
        </div>
      </div>
      <div className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-center gap-x-2 rounded-b-lg border-t bg-background/90 px-2 py-1 backdrop-blur">
        {count > 1 ? (
          <>
            <PdfPageNav current={current} count={count} onGoTo={goTo} />
            <Separator
              orientation="vertical"
              className="h-5 w-px self-center"
            />
          </>
        ) : null}
        <PdfZoomControls zoom={zoom} onZoom={(next) => applyZoom(next, null)} />
      </div>
    </>
  )
}
