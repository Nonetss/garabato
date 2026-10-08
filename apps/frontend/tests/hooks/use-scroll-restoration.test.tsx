import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test"
import { cleanup, renderHook } from "@testing-library/react"
import {
  RESERVE_MS,
  type ScrollRestorationTarget,
  useElementScrollRestoration,
} from "@/hooks/use-scroll-restoration"

const VIEWPORT = 500

/**
 * A scroller over a content wrapper with one child, laid out by hand:
 * happy-dom has no layout, so the content's height is the larger of its
 * child's height and its `min-height`, and `scrollTop` clamps to it the way
 * a browser does, firing `scroll` only when it changes.
 */
function createPage(url: string) {
  window.history.replaceState(null, "", url)
  const scroller = document.createElement("main")
  const content = document.createElement("div")
  const child = document.createElement("div")
  content.append(child)
  scroller.append(content)
  document.body.append(scroller)

  const page = { scroller, content, child, childHeight: 0 }
  const contentHeight = () => {
    const reserved = Number.parseFloat(content.style.minHeight)
    if (Number.isFinite(reserved)) return Math.max(page.childHeight, reserved)
    return page.childHeight
  }
  const maxScroll = () => Math.max(0, contentHeight() - VIEWPORT)
  let offset = 0

  child.getBoundingClientRect = () => new DOMRect(0, 0, 100, page.childHeight)
  content.getBoundingClientRect = () => new DOMRect(0, 0, 100, contentHeight())
  Object.defineProperty(scroller, "scrollTop", {
    configurable: true,
    get: () => Math.min(offset, maxScroll()),
    set: (value: number) => {
      const before = Math.min(offset, maxScroll())
      offset = Math.min(Math.max(0, value), maxScroll())
      if (offset !== before) scroller.dispatchEvent(new Event("scroll"))
    },
  })
  return page
}

type Page = ReturnType<typeof createPage>

function keyFor(url: string) {
  return `scroll:${url}`
}

function currentKey() {
  return keyFor(`${window.location.pathname}${window.location.search}`)
}

function persisted(target: Page): ScrollRestorationTarget {
  return {
    scroller: target.scroller,
    content: target.content,
    resolveStorageKey: currentKey,
  }
}

function seed(url: string, state: Record<string, number>) {
  sessionStorage.setItem(keyFor(url), JSON.stringify(state))
}

function stored(url: string) {
  const raw = sessionStorage.getItem(keyFor(url))
  if (raw === null) return null
  return JSON.parse(raw)
}

/** Grows the child and reports it the way React rendering would. */
function render(page: Page, height: number) {
  page.childHeight = height
  page.child.append(document.createElement("p"))
}

async function flushFrames() {
  await Promise.resolve()
  jest.advanceTimersByTime(20)
}

beforeEach(() => {
  jest.useFakeTimers()
  sessionStorage.clear()
  document.body.replaceChildren()
  window.requestAnimationFrame = (callback) =>
    window.setTimeout(() => callback(performance.now()), 16)
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle)
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

describe("useElementScrollRestoration", () => {
  test("reserves the saved height and applies the offset while the content is empty", () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")

    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    expect(page.content.style.minHeight).toBe("3000px")
    expect(page.scroller.scrollTop).toBe(2000)
  })

  test("releases the reservation once the content reaches it, keeping the offset", async () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")
    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    render(page, 3000)
    await flushFrames()

    expect(page.content.style.minHeight).toBe("")
    expect(page.scroller.scrollTop).toBe(2000)
  })

  test("keeps the reservation while the content is still shorter", async () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")
    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    render(page, 800)
    await flushFrames()

    expect(page.content.style.minHeight).toBe("3000px")
    expect(page.scroller.scrollTop).toBe(2000)
  })

  test("releases after RESERVE_MS and clamps to content that is now shorter", () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")
    renderHook(() => useElementScrollRestoration(() => persisted(page)))
    page.childHeight = 1200

    jest.advanceTimersByTime(RESERVE_MS)

    expect(page.content.style.minHeight).toBe("")
    expect(page.scroller.scrollTop).toBe(1200 - VIEWPORT)
  })

  test("releases as soon as the user presses inside the scroller", () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")
    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    page.scroller.dispatchEvent(new Event("pointerdown"))

    expect(page.content.style.minHeight).toBe("")
  })

  test("releases on a key press inside the scroller", () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")
    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    page.scroller.dispatchEvent(new Event("keydown"))

    expect(page.content.style.minHeight).toBe("")
  })

  test("keeps the reservation while the user wheels through it", () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")
    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    page.scroller.dispatchEvent(new Event("wheel"))
    page.scroller.scrollTop = 2300

    expect(page.content.style.minHeight).toBe("3000px")
    expect(page.scroller.scrollTop).toBe(2300)
  })

  test("applies a saved offset without a height once, with no reservation", () => {
    seed("/list", { scrollY: 600 })
    const page = createPage("/list")
    page.childHeight = 2000

    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    expect(page.content.style.minHeight).toBe("")
    expect(page.scroller.scrollTop).toBe(600)
  })

  test("starts at the top and saves nothing without a storage key", () => {
    const page = createPage("/detail")
    page.childHeight = 2000
    page.scroller.scrollTop = 900

    const { unmount } = renderHook(() =>
      useElementScrollRestoration(() => ({
        scroller: page.scroller,
        content: page.content,
        resolveStorageKey: undefined,
      }))
    )
    expect(page.scroller.scrollTop).toBe(0)

    page.scroller.scrollTop = 300
    unmount()

    expect(page.scroller.scrollTop).toBe(300)
    expect(page.content.style.minHeight).toBe("")
    expect(sessionStorage.length).toBe(0)
  })

  test("does nothing when no scroller is resolved", () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")
    page.childHeight = 3000
    page.scroller.scrollTop = 700

    renderHook(() => useElementScrollRestoration(() => null))

    expect(page.scroller.scrollTop).toBe(700)
    expect(page.content.style.minHeight).toBe("")
  })

  test("saves the offset with the content height as the user scrolls", () => {
    const page = createPage("/list")
    page.childHeight = 2500
    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    page.scroller.scrollTop = 800

    expect(stored("/list")).toEqual({ scrollY: 800, contentHeight: 2500 })
  })

  test("keeps a separate offset per query string", () => {
    seed("/list?status=active", { scrollY: 1200, contentHeight: 2400 })
    seed("/list", { scrollY: 300, contentHeight: 2400 })
    const page = createPage("/list?status=active")

    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    expect(page.scroller.scrollTop).toBe(1200)
  })

  test("saves under the query string a filter change wrote", () => {
    const page = createPage("/list")
    page.childHeight = 2500
    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    window.history.replaceState(null, "", "/list?status=active")
    page.scroller.scrollTop = 900

    expect(stored("/list?status=active")).toEqual({
      scrollY: 900,
      contentHeight: 2500,
    })
    expect(stored("/list")).toBeNull()
  })

  test("saves the reserved height when left before the content arrives", () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")
    const { unmount } = renderHook(() =>
      useElementScrollRestoration(() => persisted(page))
    )
    render(page, 400)

    document.dispatchEvent(new Event("astro:before-preparation"))
    unmount()

    expect(stored("/list")).toEqual({ scrollY: 2000, contentHeight: 3000 })
  })

  test("keeps the reservation while the next page loads", () => {
    seed("/list", { scrollY: 2000, contentHeight: 3000 })
    const page = createPage("/list")
    renderHook(() => useElementScrollRestoration(() => persisted(page)))

    document.dispatchEvent(new Event("astro:before-preparation"))

    expect(page.content.style.minHeight).toBe("3000px")
    expect(page.scroller.scrollTop).toBe(2000)
  })

  test("freezes the key once navigation starts", () => {
    const page = createPage("/list")
    page.childHeight = 2500
    const { unmount } = renderHook(() =>
      useElementScrollRestoration(() => persisted(page))
    )
    page.scroller.scrollTop = 800

    document.dispatchEvent(new Event("astro:before-preparation"))
    window.history.replaceState(null, "", "/next")
    page.scroller.scrollTop = 0
    unmount()

    expect(stored("/list")).toEqual({ scrollY: 800, contentHeight: 2500 })
    expect(stored("/next")).toBeNull()
  })

  test("freezes the key on a history navigation", () => {
    const page = createPage("/list")
    page.childHeight = 2500
    const { unmount } = renderHook(() =>
      useElementScrollRestoration(() => persisted(page))
    )
    page.scroller.scrollTop = 800

    window.history.replaceState(null, "", "/previous")
    window.dispatchEvent(new Event("popstate"))
    unmount()

    expect(stored("/list")).toEqual({ scrollY: 800, contentHeight: 2500 })
    expect(stored("/previous")).toBeNull()
  })

  test("restores the swapped-in page on astro:after-swap", () => {
    seed("/next", { scrollY: 1500, contentHeight: 2600 })
    const pages = { current: createPage("/list") }
    pages.current.childHeight = 2500
    renderHook(() =>
      useElementScrollRestoration(() => persisted(pages.current))
    )
    pages.current.scroller.scrollTop = 800

    document.dispatchEvent(new Event("astro:before-preparation"))
    document.body.replaceChildren()
    pages.current = createPage("/next")
    document.dispatchEvent(new Event("astro:after-swap"))

    expect(stored("/list")).toEqual({ scrollY: 800, contentHeight: 2500 })
    expect(pages.current.content.style.minHeight).toBe("2600px")
    expect(pages.current.scroller.scrollTop).toBe(1500)
  })
})
