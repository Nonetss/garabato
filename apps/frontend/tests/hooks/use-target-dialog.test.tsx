import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useTargetDialog } from "@/hooks/use-target-dialog"

afterEach(() => {
  cleanup()
})

describe("useTargetDialog", () => {
  test("is open exactly while it has a target", () => {
    const { result } = renderHook(() => useTargetDialog<string>())
    expect(result.current.dialogProps.open).toBe(false)

    act(() => result.current.open("row-1"))
    expect(result.current.target).toBe("row-1")
    expect(result.current.dialogProps.open).toBe(true)

    act(() => result.current.close())
    expect(result.current.target).toBeNull()
    expect(result.current.dialogProps.open).toBe(false)
  })

  test("closing through onOpenChange clears the target", () => {
    const { result } = renderHook(() => useTargetDialog<string>())
    act(() => result.current.open("row-1"))
    act(() => result.current.dialogProps.onOpenChange(true))
    expect(result.current.target).toBe("row-1")

    act(() => result.current.dialogProps.onOpenChange(false))
    expect(result.current.target).toBeNull()
  })
})
