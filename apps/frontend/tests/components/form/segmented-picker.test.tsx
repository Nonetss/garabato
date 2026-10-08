import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { SegmentedPicker } from "@/components/shared/form/segmented-picker"

const options = [
  { value: "mon", label: "L", title: "Lunes" },
  { value: "tue", label: "M", title: "Martes" },
  { value: "wed", label: "X" },
] as const

afterEach(() => {
  cleanup()
})

describe("SegmentedPicker", () => {
  test("marks only the current value as checked", () => {
    render(
      <SegmentedPicker
        label="Día"
        options={options}
        value="tue"
        onChange={() => {}}
        columns={3}
      />
    )

    expect(screen.getByRole("radiogroup", { name: "Día" })).toBeDefined()
    expect(
      screen.getByRole("radio", { name: "Martes" }).getAttribute("aria-checked")
    ).toBe("true")
    expect(
      screen.getByRole("radio", { name: "Lunes" }).getAttribute("aria-checked")
    ).toBe("false")
  })

  test("reports the clicked option", () => {
    const onChange = mock((_: string) => {})
    render(
      <SegmentedPicker
        label="Día"
        options={options}
        value="mon"
        onChange={onChange}
        columns={3}
      />
    )

    fireEvent.click(screen.getByRole("radio", { name: "X" }))
    expect(onChange).toHaveBeenCalledWith("wed")
  })
})
