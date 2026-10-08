import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useEditDialog } from "@/hooks/use-edit-dialog"

afterEach(() => {
  cleanup()
})

describe("useEditDialog", () => {
  test("opens in create mode with no target", () => {
    const { result } = renderHook(() => useEditDialog<{ id: string }>())
    act(() => result.current.openCreate())

    expect(result.current.dialogProps.open).toBe(true)
    expect(result.current.isEditing).toBe(false)
  })

  test("opens in edit mode with the target, then closes", () => {
    const { result } = renderHook(() => useEditDialog<{ id: string }>())
    act(() => result.current.openEdit({ id: "row-1" }))

    expect(result.current.editing).toEqual({ id: "row-1" })
    expect(result.current.isEditing).toBe(true)

    act(() => result.current.dialogProps.onOpenChange(false))
    expect(result.current.dialogProps.open).toBe(false)
  })

  test("create after edit drops the previous target", () => {
    const { result } = renderHook(() => useEditDialog<{ id: string }>())
    act(() => result.current.openEdit({ id: "row-1" }))
    act(() => result.current.openCreate())

    expect(result.current.editing).toBeNull()
  })
})
