import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { TotpCodeInput } from "@/components/shared/form/totp-code-input"

/** Holds the value like a real form does, so the input re-renders with it. */
function Controlled({
  onChange,
  onComplete,
}: {
  onChange: (value: string) => void
  onComplete?: (value: string) => void
}) {
  const [value, setValue] = useState("")
  return (
    <TotpCodeInput
      id="code"
      value={value}
      onChange={(code) => {
        setValue(code)
        onChange(code)
      }}
      onComplete={onComplete}
    />
  )
}

function codeInput() {
  return screen.getByRole("textbox")
}

afterEach(() => {
  cleanup()
})

describe("TotpCodeInput", () => {
  test("accepts digits", () => {
    const onChange = mock((_: string) => {})
    render(<Controlled onChange={onChange} />)

    fireEvent.change(codeInput(), { target: { value: "123" } })

    expect(onChange).toHaveBeenLastCalledWith("123")
    expect(codeInput()).toHaveProperty("value", "123")
  })

  test("rejects anything but digits", () => {
    const onChange = mock((_: string) => {})
    render(<Controlled onChange={onChange} />)

    fireEvent.change(codeInput(), { target: { value: "12a" } })

    expect(onChange).not.toHaveBeenCalled()
    expect(codeInput()).toHaveProperty("value", "")
  })

  test("reports the full code once six digits are in", () => {
    const onComplete = mock((_: string) => {})
    render(<Controlled onChange={() => {}} onComplete={onComplete} />)

    fireEvent.change(codeInput(), { target: { value: "123456" } })

    expect(onComplete).toHaveBeenCalledWith("123456")
  })

  test("renders six slots", () => {
    const { container } = render(<Controlled onChange={() => {}} />)

    expect(
      container.querySelectorAll("[data-slot='input-otp-slot']")
    ).toHaveLength(6)
  })

  test("exposes the id on the real input for its label", () => {
    render(<Controlled onChange={() => {}} />)

    expect(codeInput().id).toBe("code")
  })
})
