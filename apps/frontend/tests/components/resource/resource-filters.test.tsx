import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

function certificateFilter(
  onChange: (value: string) => void
): ResourceFilterDescriptor {
  return {
    kind: "select",
    key: "certificate",
    label: "Certificado",
    value: "all",
    onChange,
    defaultValue: "all",
    searchable: true,
    options: [
      { value: "all", label: "Todos los certificados" },
      { value: "cert-1", label: "Personal" },
      { value: "cert-2", label: "Empresa Señales" },
    ],
  }
}

function openSearchableSelect() {
  fireEvent.click(screen.getByRole("combobox", { name: "Certificado" }))
  return screen.getByPlaceholderText("Buscar en certificado…")
}

describe("ResourceFilters with a searchable select", () => {
  // A wide viewport, where the filters render inline.
  beforeAll(() => {
    setViewport(1024, 768)
  })

  afterAll(() => {
    setViewport(390, 800)
  })

  test("shows the chosen option on the trigger", () => {
    render(
      <ResourceFilters filters={[certificateFilter(() => {})]} defaultOpen />
    )

    expect(
      screen.getByRole("combobox", { name: "Certificado" }).textContent
    ).toContain("Todos los certificados")
  })

  test("narrows the options by typed text, ignoring accents", () => {
    render(
      <ResourceFilters filters={[certificateFilter(() => {})]} defaultOpen />
    )

    const search = openSearchableSelect()
    fireEvent.change(search, { target: { value: "senales" } })

    expect(
      screen.getByRole("option", { name: /Empresa Señales/ })
    ).toBeDefined()
    expect(screen.queryByRole("option", { name: /Personal/ })).toBeNull()
  })

  test("applies the picked option", () => {
    const onChange = mock((_value: string) => {})
    render(
      <ResourceFilters filters={[certificateFilter(onChange)]} defaultOpen />
    )

    openSearchableSelect()
    fireEvent.click(screen.getByRole("option", { name: /Personal/ }))

    expect(onChange).toHaveBeenCalledWith("cert-1")
  })
})
