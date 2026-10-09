import { afterEach, describe, expect, mock, test } from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { useFinePointer } from "@/hooks/use-fine-pointer"

type Listener = () => void

/** A controllable `(pointer: fine)` query, swapped in for `matchMedia`. */
function stubPointer(fine: boolean) {
  const listeners = new Set<Listener>()
  const query = {
    matches: fine,
    addEventListener: (_: string, listener: Listener) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) =>
      listeners.delete(listener),
  }
  const matchMedia = mock((_media: string) => query)
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: matchMedia,
  })
  return {
    matchMedia,
    listeners,
    change(next: boolean) {
      query.matches = next
      for (const listener of listeners) listener()
    },
  }
}

const original = window.matchMedia

afterEach(() => {
  cleanup()
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: original,
  })
})

function PointerFlag() {
  return <span>{String(useFinePointer())}</span>
}

describe("useFinePointer", () => {
  test("assumes touch when rendered on the server", () => {
    expect(renderToString(<PointerFlag />)).toBe("<span>false</span>")
  })

  test("asks for a fine primary pointer", () => {
    const pointer = stubPointer(true)
    const { result } = renderHook(() => useFinePointer())
    expect(result.current).toBe(true)
    expect(pointer.matchMedia).toHaveBeenCalledWith("(pointer: fine)")
  })

  test("is false on touch", () => {
    stubPointer(false)
    const { result } = renderHook(() => useFinePointer())
    expect(result.current).toBe(false)
  })

  test("follows the pointer when it changes", () => {
    const pointer = stubPointer(false)
    const { result } = renderHook(() => useFinePointer())
    act(() => pointer.change(true))
    expect(result.current).toBe(true)
  })

  test("stops listening on unmount", () => {
    const pointer = stubPointer(true)
    const { unmount } = renderHook(() => useFinePointer())
    expect(pointer.listeners.size).toBe(1)
    unmount()
    expect(pointer.listeners.size).toBe(0)
  })
})
