import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useDialogForm } from "@/hooks/use-dialog-form"

type Values = { name: string; slug: string; seats: number }

const empty: Values = { name: "", slug: "", seats: 1 }

function renderForm(open: boolean, initial?: Partial<Values>) {
  return renderHook(
    (props: { open: boolean; initial?: Partial<Values> }) =>
      useDialogForm(props.open, empty, props.initial),
    { initialProps: { open, initial } }
  )
}

afterEach(() => {
  cleanup()
})

describe("useDialogForm", () => {
  test("seeds from empty merged with initial", () => {
    const { result } = renderForm(true, { name: "Acme" })
    expect(result.current.values).toEqual({ name: "Acme", slug: "", seats: 1 })
  })

  test("reseeds from the current initial each time it opens", () => {
    const { result, rerender } = renderForm(true, { name: "Acme" })
    act(() => result.current.set("name", "Edited"))

    rerender({ open: false, initial: { name: "Other" } })
    rerender({ open: true, initial: { name: "Other" } })

    expect(result.current.values.name).toBe("Other")
  })

  test("a field error clears when that field changes", () => {
    const { result } = renderForm(true)
    act(() => {
      result.current.setError("name", "Obligatorio")
      result.current.setError("slug", "Obligatorio")
    })
    act(() => result.current.field("name").onChange("Acme"))

    expect(result.current.errors).toEqual({ slug: "Obligatorio" })
    expect(result.current.field("name")).toMatchObject({
      value: "Acme",
      error: undefined,
    })
  })

  test("trimmed trims string fields only", () => {
    const { result } = renderForm(true, { name: "  Acme ", seats: 3 })
    expect(result.current.trimmed()).toEqual({
      name: "Acme",
      slug: "",
      seats: 3,
    })
  })

  test("reset restores the seed and clears errors", () => {
    const { result } = renderForm(true, { name: "Acme" })
    act(() => {
      result.current.set("name", "Edited")
      result.current.setError("slug", "Obligatorio")
    })
    act(() => result.current.reset())

    expect(result.current.values.name).toBe("Acme")
    expect(result.current.errors).toEqual({})
  })
})
