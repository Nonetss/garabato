import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, renderHook } from "@testing-library/react"
import { useOnOpen } from "@/hooks/use-on-open"

afterEach(() => {
  cleanup()
})

describe("useOnOpen", () => {
  test("seeds only on the closed-to-open transition", () => {
    const seed = mock(() => {})
    const { rerender } = renderHook(({ open }) => useOnOpen(open, seed), {
      initialProps: { open: false },
    })

    rerender({ open: false })
    expect(seed).not.toHaveBeenCalled()

    rerender({ open: true })
    rerender({ open: true })
    expect(seed).toHaveBeenCalledTimes(1)

    rerender({ open: false })
    rerender({ open: true })
    expect(seed).toHaveBeenCalledTimes(2)
  })
})
