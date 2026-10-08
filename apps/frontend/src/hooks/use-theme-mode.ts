import { useEffect, useState } from "react"
import { flushSync } from "react-dom"

import { applyThemeMode, getStoredThemeMode, type ThemeMode } from "@/lib/theme"

export interface ThemeChangeOrigin {
  x: number
  y: number
}

export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>("system")

  useEffect(() => {
    setModeState(getStoredThemeMode())
  }, [])

  function setMode(next: ThemeMode, origin?: ThemeChangeOrigin) {
    const apply = () => {
      applyThemeMode(next)
      setModeState(next)
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    if (!origin || !document.startViewTransition || prefersReducedMotion) {
      flushSync(apply)
      return
    }

    const { x, y } = origin
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    // Gate the root-group `animation: none` / z-index rules in global.css
    // so they do not also fire on Astro ClientRouter navigations.
    const root = document.documentElement
    root.classList.add("theme-transitioning")

    try {
      const transition = document.startViewTransition(() => flushSync(apply))

      void transition.ready
        .then(() => {
          root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 450,
              easing: "ease-in-out",
              pseudoElement: "::view-transition-new(root)",
            }
          )
        })
        .catch(() => {
          // Skipped/aborted (hidden document, reduced-motion mid-flight).
        })

      void transition.finished.finally(() => {
        root.classList.remove("theme-transitioning")
      })
    } catch {
      root.classList.remove("theme-transitioning")
      flushSync(apply)
    }
  }

  return { mode, setMode }
}
