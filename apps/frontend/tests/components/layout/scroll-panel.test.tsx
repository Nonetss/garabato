import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { ScrollPanel } from "@/components/shared/layout/scroll-panel"

afterEach(() => {
  cleanup()
})

describe("ScrollPanel", () => {
  test("hands the scrolling element to scrollRef", () => {
    const received: Array<HTMLDivElement | null> = []
    render(
      <ScrollPanel
        scrollRef={(node) => {
          received.push(node)
        }}
      >
        <p>Fila</p>
      </ScrollPanel>
    )

    expect(received[0]?.textContent).toBe("Fila")
  })

  test("renders the footer only when given", () => {
    const { rerender } = render(
      <ScrollPanel>
        <p>Fila</p>
      </ScrollPanel>
    )
    expect(screen.queryByText("1–20 de 42")).toBe(null)

    rerender(
      <ScrollPanel footer={<span>1–20 de 42</span>}>
        <p>Fila</p>
      </ScrollPanel>
    )
    expect(screen.getByText("1–20 de 42")).toBeDefined()
  })
})
