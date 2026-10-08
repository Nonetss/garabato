import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import {
  QueryState,
  type QueryStateQuery,
} from "@/components/shared/feedback/query-state"

type Rows = string[]

function query(
  overrides: Partial<QueryStateQuery<Rows>>
): QueryStateQuery<Rows> {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    refetch: () => {},
    ...overrides,
  }
}

function renderState(
  state: QueryStateQuery<Rows>,
  options: { hasActiveFilters?: boolean; onClear?: () => void } = {}
) {
  return render(
    <QueryState
      query={state}
      loading="Cargando crons"
      error={{ title: "No se pudieron cargar" }}
      isEmpty={(rows) => rows.length === 0}
      empty={{ title: "Todavía no hay crons" }}
      hasActiveFilters={options.hasActiveFilters}
      filteredEmpty={{ title: "Sin coincidencias", onClear: options.onClear }}
    >
      {(rows) => (
        <ul>
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      )}
    </QueryState>
  )
}

afterEach(() => {
  cleanup()
})

describe("QueryState", () => {
  test("shows the error state with a retry that refetches", () => {
    const refetch = mock(() => {})
    renderState(query({ isError: true, refetch }))

    expect(screen.getByText("No se pudieron cargar")).toBeDefined()
    expect(screen.queryByRole("list")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test("shows the loading title while pending", () => {
    renderState(query({ isPending: true }))
    expect(screen.getByText("Cargando crons")).toBeDefined()
  })

  test("shows the empty state for an empty source", () => {
    renderState(query({ data: [] }))
    expect(screen.getByText("Todavía no hay crons")).toBeDefined()
  })

  test("shows the filtered-empty state with a clear action under filters", () => {
    const onClear = mock(() => {})
    renderState(query({ data: [] }), { hasActiveFilters: true, onClear })

    expect(screen.getByText("Sin coincidencias")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  test("renders its children with the data on success", () => {
    renderState(query({ data: ["Nightly", "Hourly"] }))
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent)
    ).toEqual(["Nightly", "Hourly"])
  })
})
