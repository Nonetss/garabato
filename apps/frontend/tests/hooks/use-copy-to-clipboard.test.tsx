import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  spyOn,
  test,
} from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import { toast } from "sonner"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"

const writeText = spyOn(navigator.clipboard, "writeText")
const toastError = spyOn(toast, "error")

beforeEach(() => {
  jest.useFakeTimers()
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  toastError.mockReset()
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

describe("useCopyToClipboard", () => {
  test("copies, flags copied and resets after resetMs", async () => {
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: 1000 }))

    let copied = false
    await act(async () => {
      copied = await result.current.copy("secret")
    })

    expect(copied).toBe(true)
    expect(writeText).toHaveBeenCalledWith("secret")
    expect(result.current.copied).toBe(true)

    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.copied).toBe(false)
  })

  test("reports a failure with the default toast", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    const { result } = renderHook(() => useCopyToClipboard())

    let copied = true
    await act(async () => {
      copied = await result.current.copy("secret")
    })

    expect(copied).toBe(false)
    expect(result.current.copied).toBe(false)
    expect(toastError).toHaveBeenCalledWith("No se pudo copiar", undefined)
  })

  test("stays silent on failure when onError is false", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    const { result } = renderHook(() => useCopyToClipboard({ onError: false }))

    await act(async () => {
      await result.current.copy("secret")
    })

    expect(toastError).not.toHaveBeenCalled()
  })
})
