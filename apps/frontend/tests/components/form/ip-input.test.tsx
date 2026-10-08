import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { IpInput } from "@/components/shared/form/ip-input"

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
    <IpInput
      value={value}
      onChange={(ip) => {
        setValue(ip)
        onChange(ip)
      }}
    />
  )
}

function octet(index: number) {
  return screen.getByRole("textbox", { name: `Octeto ${index}` })
}

function renderIp(value: string) {
  const onChange = mock((_: string) => {})
  render(<Controlled initial={value} onChange={onChange} />)
  return onChange
}

afterEach(() => {
  cleanup()
})

describe("IpInput", () => {
  test("splits a valid address across the four octets", () => {
    renderIp("192.168.1.10")
    expect([1, 2, 3, 4].map((index) => octet(index))).toMatchObject([
      { value: "192" },
      { value: "168" },
      { value: "1" },
      { value: "10" },
    ])
  })

  test("reports the joined address when an octet changes", () => {
    const onChange = renderIp("192.168.1.10")
    fireEvent.change(octet(4), { target: { value: "20" } })
    expect(onChange).toHaveBeenLastCalledWith("192.168.1.20")
  })

  test("caps an octet at 255 and drops non-digits", () => {
    const onChange = renderIp("10.0.0.1")
    fireEvent.change(octet(2), { target: { value: "9a99" } })
    expect(octet(2)).toHaveProperty("value", "255")
    expect(onChange).toHaveBeenLastCalledWith("10.255.0.1")
  })

  test("reports an empty value while an octet is missing", () => {
    const onChange = renderIp("10.0.0.1")
    fireEvent.change(octet(3), { target: { value: "" } })
    expect(onChange).toHaveBeenLastCalledWith("")
  })

  test("a pasted address fills every octet", () => {
    const onChange = renderIp("")
    fireEvent.paste(octet(1), {
      clipboardData: { getData: () => " 172.16.0.5 " },
    })
    expect(onChange).toHaveBeenLastCalledWith("172.16.0.5")
    expect(octet(4)).toHaveProperty("value", "5")
  })
})
