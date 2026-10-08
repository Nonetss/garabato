import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NumberStepper } from "@/components/shared/form/number-stepper"

function renderStepper(value: number) {
  const onChange = mock((_: number) => {})
  render(
    <NumberStepper
      label="Hora"
      value={value}
      min={0}
      max={23}
      onChange={onChange}
    />
  )
  return { onChange, input: screen.getByRole("textbox", { name: "Hora" }) }
}

afterEach(() => {
  cleanup()
})

describe("NumberStepper", () => {
  test("shows the value zero-padded", () => {
    const { input } = renderStepper(7)
    expect(input).toHaveProperty("value", "07")
  })

  test("the buttons step by one", () => {
    const { onChange } = renderStepper(7)
    fireEvent.click(screen.getByRole("button", { name: "Hora: aumentar" }))
    fireEvent.click(screen.getByRole("button", { name: "Hora: disminuir" }))
    expect(onChange.mock.calls).toEqual([[8], [6]])
  })

  test("wraps to the minimum past its maximum", () => {
    const { onChange, input } = renderStepper(23)
    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  test("wraps to the maximum below its minimum", () => {
    const { onChange, input } = renderStepper(0)
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(onChange).toHaveBeenLastCalledWith(23)
  })

  test("Home and End jump to the bounds", () => {
    const { onChange, input } = renderStepper(10)
    fireEvent.keyDown(input, { key: "Home" })
    fireEvent.keyDown(input, { key: "End" })
    expect(onChange.mock.calls).toEqual([[0], [23]])
  })

  test("a typed value is clamped to the bounds on blur", () => {
    const { onChange, input } = renderStepper(10)
    fireEvent.change(input, { target: { value: "99" } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(23)
  })
})
