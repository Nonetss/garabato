import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { IconButton } from "@/components/shared/form/icon-button"

function TrashIcon({ className }: { className?: string }) {
  return <svg data-testid="trash" className={className} />
}

afterEach(() => {
  cleanup()
})

describe("IconButton", () => {
  test("is named by its label and fires onClick", () => {
    const onClick = mock(() => {})
    render(
      <IconButton label="Eliminar rol" icon={TrashIcon} onClick={onClick} />
    )

    const button = screen.getByRole("button", { name: "Eliminar rol" })
    expect(button.getAttribute("type")).toBe("button")
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test("prefers the fuller accessible label when given", () => {
    render(
      <IconButton
        label="Eliminar etiqueta"
        accessibleLabel="Eliminar Contratos"
        icon={TrashIcon}
      />
    )

    expect(
      screen.getByRole("button", { name: "Eliminar Contratos" })
    ).toBeDefined()
    expect(screen.queryByRole("button", { name: "Eliminar etiqueta" })).toBe(
      null
    )
  })

  test("swaps the glyph for a spinner and marks itself busy while pending", () => {
    render(
      <IconButton label="Añadir miembro" icon={TrashIcon} pending disabled />
    )

    const button = screen.getByRole("button", { name: "Añadir miembro" })
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(screen.queryByTestId("trash")).toBe(null)
  })

  test("passes the glyph class to the icon", () => {
    render(
      <IconButton label="Editar" icon={TrashIcon} iconClassName="size-3.5" />
    )

    expect(screen.getByTestId("trash").getAttribute("class")).toBe("size-3.5")
  })
})
