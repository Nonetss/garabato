import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { FilterChips } from "@/components/shared/resource/filter-chips"

afterEach(() => {
  cleanup()
})

describe("FilterChips", () => {
  test("renders nothing without active chips", () => {
    const { container } = render(<FilterChips chips={[]} onClear={() => {}} />)
    expect(container.innerHTML).toBe("")
  })

  test("removes a single chip through its own button", () => {
    const removeStatus = mock(() => {})
    const removeOwner = mock(() => {})
    render(
      <FilterChips
        chips={[
          { key: "status", label: "Activos", onRemove: removeStatus },
          { key: "owner", label: "Ana", onRemove: removeOwner },
        ]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro: Ana" }))
    expect(removeOwner).toHaveBeenCalledTimes(1)
    expect(removeStatus).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Limpiar" })).toBeNull()
  })

  test("offers clearing every filter when onClear is given", () => {
    const onClear = mock(() => {})
    render(
      <FilterChips
        chips={[{ key: "status", label: "Activos", onRemove: () => {} }]}
        onClear={onClear}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
