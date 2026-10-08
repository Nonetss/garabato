import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import {
  EntityList,
  type EntityListDefinition,
} from "@/components/shared/resource/entity-list"

type Item = { id: string; name: string }

const items: Item[] = [
  { id: "a", name: "Contrato" },
  { id: "b", name: "Factura" },
]

const definition: EntityListDefinition<Item> = {
  getKey: (item) => item.id,
  getPrimary: (item) => item.name,
}

afterEach(() => {
  cleanup()
})

describe("EntityList", () => {
  test("renders rows without checkboxes when there is no selection", () => {
    render(
      <EntityList items={items} context={undefined} definition={definition} />
    )

    expect(screen.getByText("Contrato")).toBeDefined()
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
  })

  test("adds a named checkbox per row that reports toggles", () => {
    const onToggle = mock((_: Item) => {})
    render(
      <EntityList
        items={items}
        context={undefined}
        definition={definition}
        selection={{
          isSelected: (item) => item.id === "b",
          onToggle,
          getLabel: (item) => `Seleccionar ${item.name}`,
        }}
      />
    )

    const contrato = screen.getByRole("checkbox", {
      name: "Seleccionar Contrato",
    })
    const factura = screen.getByRole("checkbox", {
      name: "Seleccionar Factura",
    })
    expect(contrato.getAttribute("aria-checked")).toBe("false")
    expect(factura.getAttribute("aria-checked")).toBe("true")

    fireEvent.click(contrato)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle.mock.calls[0]?.[0]).toEqual(items[0])
  })

  test("wires a row's drag-and-drop props onto it", () => {
    const onDrop = mock(() => {})
    render(
      <EntityList
        items={items}
        context={undefined}
        definition={{
          ...definition,
          getRowDragProps: (item) => ({
            draggable: item.id === "a",
            onDrop,
            dropActive: item.id === "b",
          }),
        }}
      />
    )

    const [first, second] = screen.getAllByRole("listitem")
    expect(first?.getAttribute("draggable")).toBe("true")
    expect(second?.getAttribute("draggable")).toBe("false")
    expect(second?.className).toContain("ring-2")
    expect(first?.className).not.toContain("ring-2")

    if (second) fireEvent.drop(second)
    expect(onDrop).toHaveBeenCalledTimes(1)
  })
})
