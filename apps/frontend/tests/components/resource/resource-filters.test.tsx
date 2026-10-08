import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import {
  type ResourceFilterDescriptor,
  ResourceFilters,
} from "@/components/shared/resource/resource-filters"

const filters: ResourceFilterDescriptor[] = [
  {
    kind: "search",
    key: "query",
    label: "Nombre",
    value: "",
    onChange: () => {},
  },
]

// happy-dom's window API, reached through a guard: `happy-dom` itself is not
// a dependency whose types the frontend can import.
function setViewport(width: number, height: number) {
  const api: unknown = Reflect.get(window, "happyDOM")
  if (
    typeof api !== "object" ||
    api === null ||
    !("setViewport" in api) ||
    typeof api.setViewport !== "function"
  ) {
    throw new Error("Expected the happy-dom window API")
  }
  api.setViewport({ width, height })
}

// A phone-sized viewport, where the filters move to the bottom action bar.
beforeAll(() => {
  setViewport(390, 800)
})

afterAll(() => {
  setViewport(1024, 768)
})

afterEach(() => {
  cleanup()
})

describe("ResourceFilters on a narrow viewport", () => {
  test("shows the filter action bar by default", () => {
    render(<ResourceFilters filters={filters} />)

    expect(screen.getByRole("button", { name: /Filtros/ })).toBeDefined()
  })

  test("leaves the bottom edge free with hideMobileActionBar", () => {
    render(<ResourceFilters filters={filters} hideMobileActionBar />)

    expect(screen.queryByRole("button", { name: /Filtros/ })).toBeNull()
  })
})
