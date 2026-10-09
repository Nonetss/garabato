import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import {
  CollapsibleFilters,
  type FilterColumns,
  FilterField,
} from "@/components/shared/form/collapsible-filters"

afterEach(cleanup)

// The grid the fields sit in, read from the first field's parent.
function gridClasses(columns: FilterColumns, fieldCount: number) {
  render(
    <CollapsibleFilters columns={columns} defaultOpen>
      {Array.from({ length: fieldCount }, (_, index) => (
        <FilterField key={`field-${index + 1}`} label={`Campo ${index + 1}`}>
          <span>control</span>
        </FilterField>
      ))}
    </CollapsibleFilters>
  )
  const grid = screen.getByText("Campo 1").closest(".grid")
  if (!grid) throw new Error("no filter grid")
  return grid.className
}

describe("CollapsibleFilters", () => {
  test("grows from 1 to 4 columns as the panel widens", () => {
    const classes = gridClasses(4, 4)

    expect(classes).toContain("grid-cols-1")
    expect(classes).toContain("@lg:grid-cols-2")
    expect(classes).toContain("@3xl:grid-cols-3")
    expect(classes).toContain("@5xl:grid-cols-4")
  })

  test("never lays out more columns than fields", () => {
    const classes = gridClasses(4, 2)

    expect(classes).toContain("@lg:grid-cols-2")
    expect(classes).not.toContain("@3xl:grid-cols-3")
  })

  test("defaults to at most 3 columns", () => {
    render(
      <CollapsibleFilters defaultOpen>
        {["A", "B", "C", "D"].map((label) => (
          <FilterField key={label} label={label}>
            <span>control</span>
          </FilterField>
        ))}
      </CollapsibleFilters>
    )
    const grid = screen.getByText("A").closest(".grid")

    expect(grid?.className).toContain("@3xl:grid-cols-3")
    expect(grid?.className).not.toContain("@5xl:grid-cols-4")
  })
})
