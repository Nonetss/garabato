import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

describe("useDebouncedValue", () => {
  test("trails its input until the delay elapses after the last change", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } }
    )

    rerender({ value: "ab" })
    act(() => jest.advanceTimersByTime(200))
    rerender({ value: "abc" })
    act(() => jest.advanceTimersByTime(200))
    expect(result.current).toBe("a")

    act(() => jest.advanceTimersByTime(100))
    expect(result.current).toBe("abc")
  })
})
