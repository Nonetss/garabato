import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"

afterEach(() => {
  cleanup()
})

describe("SoftCardListItem", () => {
  test("renders a list item with its title, description and trailing slot", () => {
    render(
      <SoftCardList as="ul">
        <SoftCardListItem
          title="Ana López"
          description="ana@example.com"
          trailing={<button type="button">Quitar</button>}
        />
      </SoftCardList>
    )

    const item = screen.getByRole("listitem")
    expect(item.textContent).toContain("Ana López")
    expect(item.textContent).toContain("ana@example.com")
    expect(screen.getByRole("button", { name: "Quitar" })).toBeDefined()
  })

  test("leaves out the lines it isn't given", () => {
    render(
      <SoftCardList as="ul">
        <SoftCardListItem title="v2" note={null} />
      </SoftCardList>
    )

    expect(screen.getByRole("listitem").querySelectorAll("p")).toHaveLength(1)
  })

  test("adds the note as its own line", () => {
    render(
      <SoftCardList as="ul">
        <SoftCardListItem
          title="Ana López"
          description="08/10/2026"
          note="Motivo: conforme"
        />
      </SoftCardList>
    )

    const lines = screen.getByRole("listitem").querySelectorAll("p")
    expect(Array.from(lines, (line) => line.textContent)).toEqual([
      "Ana López",
      "08/10/2026",
      "Motivo: conforme",
    ])
  })
})
