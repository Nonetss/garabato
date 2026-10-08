import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import { type QueryParamCodec, useQueryParam } from "@/hooks/use-query-param"

const pageCodec: QueryParamCodec<number> = {
  parse: (raw) => Number(raw),
  serialize: (value) => String(value),
}

function searchParam(key: string) {
  return new URL(window.location.href).searchParams.get(key)
}

beforeEach(() => {
  window.history.replaceState(null, "", "/crons")
})

afterEach(() => {
  cleanup()
})

describe("useQueryParam", () => {
  test("starts from the default when the param is absent", () => {
    const { result } = renderHook(() => useQueryParam("q", ""))
    expect(result.current[0]).toBe("")
  })

  test("writes the value to the URL and a fresh render parses it back", () => {
    const first = renderHook(() => useQueryParam("page", 1, pageCodec))
    act(() => first.result.current[1](3))

    expect(first.result.current[0]).toBe(3)
    expect(searchParam("page")).toBe("3")

    const second = renderHook(() => useQueryParam("page", 1, pageCodec))
    expect(second.result.current[0]).toBe(3)
  })

  test("drops the param once the value is back to the default", () => {
    const { result } = renderHook(() => useQueryParam("q", ""))
    act(() => result.current[1]("cron"))
    expect(searchParam("q")).toBe("cron")

    act(() => result.current[1](""))
    expect(searchParam("q")).toBeNull()
  })

  test("resyncs on back/forward navigation", () => {
    const { result } = renderHook(() => useQueryParam("q", ""))
    act(() => {
      window.history.replaceState(null, "", "/crons?q=nightly")
      window.dispatchEvent(new window.Event("popstate"))
    })
    expect(result.current[0]).toBe("nightly")
  })
})
