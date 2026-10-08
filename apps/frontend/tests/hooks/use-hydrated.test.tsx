import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, renderHook } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { useHydrated } from "@/hooks/use-hydrated"

function HydrationFlag() {
  const hydrated = useHydrated()
  return <span>{String(hydrated)}</span>
}

afterEach(() => {
  cleanup()
})

describe("useHydrated", () => {
  test("is false when rendered on the server", () => {
    expect(renderToString(<HydrationFlag />)).toBe("<span>false</span>")
  })

  test("is true once rendered on the client", () => {
    const { result } = renderHook(() => useHydrated())
    expect(result.current).toBe(true)
  })
})
