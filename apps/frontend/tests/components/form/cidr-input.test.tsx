import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { CidrInput } from "@/components/shared/form/cidr-input"

/** Holds the value like a real form does, so the input re-renders with it. */
function Controlled({
  initial,
  onChange,
}: {
  initial: string
  onChange: (value: string) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <CidrInput
      value={value}
      onChange={(cidr) => {
        setValue(cidr)
        onChange(cidr)
      }}
    />
  )
}

function field(name: string) {
  return screen.getByRole("textbox", { name })
}

function renderCidr(value: string) {
  const onChange = mock((_: string) => {})
  render(<Controlled initial={value} onChange={onChange} />)
  return onChange
}

afterEach(() => {
  cleanup()
})

describe("CidrInput", () => {
  test("splits a valid CIDR into octets and prefix", () => {
    renderCidr("10.0.0.0/8")
    expect(field("Octeto 1")).toHaveProperty("value", "10")
    expect(field("Prefijo")).toHaveProperty("value", "8")
  })

  test("caps the prefix at 32", () => {
    const onChange = renderCidr("10.0.0.0/8")
    fireEvent.change(field("Prefijo"), { target: { value: "48" } })
    expect(field("Prefijo")).toHaveProperty("value", "32")
    expect(onChange).toHaveBeenLastCalledWith("10.0.0.0/32")
  })

  test("reports an empty value while a part is missing", () => {
    const onChange = renderCidr("10.0.0.0/8")
    fireEvent.change(field("Prefijo"), { target: { value: "" } })
    expect(onChange).toHaveBeenLastCalledWith("")
  })

  test("a pasted CIDR fills every part", () => {
    const onChange = renderCidr("")
    fireEvent.paste(field("Octeto 1"), {
      clipboardData: { getData: () => "192.168.0.0/24" },
    })
    expect(onChange).toHaveBeenLastCalledWith("192.168.0.0/24")
  })
})
