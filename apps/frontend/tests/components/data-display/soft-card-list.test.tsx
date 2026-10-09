import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

  test("makes a selectable row a button named by its title", () => {
    const chosen: string[] = []
    render(
      <SoftCardList as="ul">
        <SoftCardListItem
          title="v2 · firmada"
          selected
          onSelect={() => chosen.push("v2")}
          trailing={<button type="button">Descargar</button>}
        />
        <SoftCardListItem
          title="v1 · original"
          onSelect={() => chosen.push("v1")}
        />
      </SoftCardList>
    )

    const shown = screen.getByRole("button", { name: "v2 · firmada" })
    const other = screen.getByRole("button", { name: "v1 · original" })
    expect(shown.getAttribute("aria-current")).toBe("true")
    expect(other.getAttribute("aria-current")).toBeNull()

    fireEvent.click(other)
    fireEvent.click(screen.getByRole("button", { name: "Descargar" }))
    expect(chosen).toEqual(["v1"])
  })

  test("keeps a plain title when the row is not selectable", () => {
    render(
      <SoftCardList as="ul">
        <SoftCardListItem title="Ana López" />
      </SoftCardList>
    )

    expect(screen.queryByRole("button")).toBeNull()
  })
})
