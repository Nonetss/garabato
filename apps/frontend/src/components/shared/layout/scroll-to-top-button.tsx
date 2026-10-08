import { useEffect, useState } from "react"
import { Hint } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import { useScrolled } from "@/hooks/use-scrolled"
import { getIcon } from "@/lib/icon-registry"

const ScrollToTopIcon = getIcon("navigation", "scrollToTop")

const APP_SCROLLER = "[data-app-scroller]"
const EXIT_ANIMATION_MS = 200

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" })
  for (const node of document.querySelectorAll<HTMLElement>(APP_SCROLLER)) {
    node.scrollTo({ top: 0, behavior: "smooth" })
  }
}

function pageWantsScrollToTop() {
  return document.querySelector("[data-scroll-to-top]") !== null
}

/**
 * Floating button that appears once the page has scrolled past `threshold`
 * and jumps back to the top. Reuses `useScrolled`, which already tracks both
 * `window` and any `[data-app-scroller]` container.
 *
 * Mounted once from `Layout.astro` as a tight `position: fixed` box (see
 * `.scroll-to-top-root` in `global.css`) so it cannot stretch into a
 * full-width bar or participate in the body's flex column. Pages opt in
 * with `data-scroll-to-top` on the inset scroller.
 */
export function ScrollToTopButton({ threshold = 400 }: { threshold?: number }) {
  const scrolled = useScrolled(threshold)
  const [enabled, setEnabled] = useState(false)
  const visible = enabled && scrolled
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const update = () => setEnabled(pageWantsScrollToTop())
    update()
    document.addEventListener("astro:page-load", update)
    document.addEventListener("astro:after-swap", update)
    return () => {
      document.removeEventListener("astro:page-load", update)
      document.removeEventListener("astro:after-swap", update)
    }
  }, [])

  useEffect(() => {
    if (visible) {
      setMounted(true)
      return
    }
    const timeout = setTimeout(() => setMounted(false), EXIT_ANIMATION_MS)
    return () => clearTimeout(timeout)
  }, [visible])

  if (!mounted) return null

  return (
    <Hint label="Volver arriba" side="top">
      <Button
        type="button"
        variant="default"
        size="icon"
        data-slot="scroll-to-top"
        data-state={visible ? "open" : "closed"}
        className="size-11 rounded-full shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-75 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-75 data-[state=open]:slide-in-from-bottom-4 md:size-10"
        aria-label="Volver arriba"
        onClick={scrollToTop}
      >
        <ScrollToTopIcon className="size-4" />
      </Button>
    </Hint>
  )
}
