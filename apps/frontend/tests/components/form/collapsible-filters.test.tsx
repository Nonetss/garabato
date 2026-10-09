import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import {
  CollapsibleFilters,
  type FilterColumns,
  FilterField,
} from "@/components/shared/form/collapsible-filters"
import { NBSP } from "@/lib/format"

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

  test("binds the active count to its noun", () => {
    render(
      <CollapsibleFilters activeCount={3}>
        <FilterField label="A">
          <span>control</span>
        </FilterField>
      </CollapsibleFilters>
    )

    // The default normalizer folds the no-break space into a plain one.
    const counter = screen.getByText(`3${NBSP}activos`, {
      normalizer: (text) => text,
    })

    expect(counter).toBeDefined()
  })

  test("hides the counter while no filter is active", () => {
    render(
      <CollapsibleFilters>
        <FilterField label="A">
          <span>control</span>
        </FilterField>
      </CollapsibleFilters>
    )

    expect(screen.queryByText(/activo/)).toBeNull()
  })
})
