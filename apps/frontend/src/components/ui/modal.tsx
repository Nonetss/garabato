import { getIcon } from "@/lib/icon-registry"

const ChevronLeft = getIcon("controls", "previous")
const ChevronRight = getIcon("controls", "next")
const XIcon = getIcon("controls", "close")

import { type ReactNode, useEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  /** Sticky footer (e.g. submit buttons). Rendered below the children
   *  with a top border, inside the card. */
  footer?: ReactNode
  /** Disable backdrop click + ESC. */
  dismissible?: boolean
  /** Gallery-style navigation: floating chevrons on the backdrop, outside
   *  the card, plus ArrowLeft/ArrowRight. Omit both to skip the arrows. */
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

/**
 * Minimal modal primitive: full-screen backdrop + centered card.
 * The card itself is the scroll container (overflow-y-auto), so the
 * caller can pass any children without worrying about inner heights.
 *
 * Use instead of shadcn Dialog when you need full control over the
 * internal layout (no built-in padding/header).
 */
export function Modal({
  open,
  onClose,
  children,
  className,
  footer,
  dismissible = true,
  onPrev,
  onNext,
  hasPrev = true,
  hasNext = true,
}: ModalProps) {
  const canNavigate = !!onPrev || !!onNext

  useEffect(() => {
    if (!open || !dismissible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, dismissible, onClose])

  useEffect(() => {
    if (!open || !canNavigate) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && hasPrev) onPrev?.()
      else if (e.key === "ArrowRight" && hasNext) onNext?.()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, canNavigate, hasPrev, hasNext, onPrev, onNext])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return createPortal(
    // A plain div, not a button: it only needs to catch a backdrop click to
    // dismiss, and a <button> here would nest the Button elements below
    // inside another interactive control — invalid HTML content model and
    // unpredictable in the accessibility tree. The backdrop itself is
    // deliberately not a keyboard target; Escape (wired above) is the
    // keyboard-equivalent dismiss action, matching WAI-ARIA dialog guidance.
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss; Escape is the keyboard equivalent
    // biome-ignore lint/a11y/useKeyWithClickEvents: same as above
    <div
      className="fixed inset-0 z-100 flex cursor-default items-center justify-center bg-black/50 p-4"
      onClick={dismissible ? onClose : undefined}
    >
      {onPrev ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Anterior"
          disabled={!hasPrev}
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          className="fixed left-2 top-1/2 z-10 size-11 -translate-y-1/2 rounded-full bg-background/80 text-foreground shadow-md backdrop-blur hover:bg-background disabled:opacity-0 sm:left-4"
        >
          <ChevronLeft className="size-5" />
        </Button>
      ) : null}
      {onNext ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Siguiente"
          disabled={!hasNext}
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          className="fixed right-2 top-1/2 z-10 size-11 -translate-y-1/2 rounded-full bg-background/80 text-foreground shadow-md backdrop-blur hover:bg-background disabled:opacity-0 sm:right-4"
        >
          <ChevronRight className="size-5" />
        </Button>
      ) : null}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-[calc(100dvh-10rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-background shadow-lg",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {dismissible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-3 top-3 z-10"
          >
            <XIcon className="size-4" />
          </Button>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
