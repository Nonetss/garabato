import { useEffect, useRef, useState } from "react"

const APP_SCROLLER = "[data-app-scroller]"

function currentScrollY() {
  let max = window.scrollY
  for (const node of document.querySelectorAll<HTMLElement>(APP_SCROLLER)) {
    if (node.scrollTop > max) max = node.scrollTop
  }
  return max
}

/**
 * `true` while the page is at the top (within `topThreshold`) or scrolling
 * up, `false` while scrolling down past it — for chrome that should get out
 * of the way while the user reads down a long list and reappear once they
 * scroll back up (`ListActionBar`). Small jitters (under 8px) are ignored so
 * momentum scrolling on touch doesn't flicker the bar.
 */
export function useScrollDirection(topThreshold = 48) {
  const [visible, setVisible] = useState(true)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = currentScrollY()
    const update = () => {
      const y = currentScrollY()
      const delta = y - lastY.current
      if (y <= topThreshold) {
        setVisible(true)
      } else if (Math.abs(delta) > 8) {
        setVisible(delta < 0)
      }
      lastY.current = y
    }
    window.addEventListener("scroll", update, { passive: true })
    document.addEventListener("scroll", update, {
      capture: true,
      passive: true,
    })
    return () => {
      window.removeEventListener("scroll", update)
      document.removeEventListener("scroll", update, { capture: true })
    }
  }, [topThreshold])

  return visible
}
