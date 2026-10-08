import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { HeroCount, PageHero } from "@/components/shared/layout/page-hero"
import { getAppSurface } from "@/lib/app-surfaces"

afterEach(() => {
  cleanup()
})

describe("PageHero", () => {
  test("takes the title and description from the surface", () => {
    const surface = getAppSurface("documents")
    render(<PageHero surface="documents" />)

    expect(
      screen.getByRole("heading", { level: 1, name: surface.label })
    ).toBeDefined()
    expect(screen.getByText(surface.description)).toBeDefined()
  })

  test("lets an entity name override the surface title", () => {
    render(
      <PageHero
        surface="document-detail"
        title="contrato_de_arrendamiento_2026.pdf"
        description="3 páginas · 412 KB"
      />
    )

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading.textContent).toBe("contrato_de_arrendamiento_2026.pdf")
    // A file name is one unbroken token; the title must be allowed to wrap.
    expect(heading.className).toContain("wrap-break-word")
    expect(screen.getByText("3 páginas · 412 KB")).toBeDefined()
  })

  test("renders the action and the ledger line under the header", () => {
    render(
      <PageHero
        surface="documents"
        action={<button type="button">Subir PDF</button>}
      >
        <p>4 firmados · 12 total</p>
      </PageHero>
    )

    expect(screen.getByRole("button", { name: "Subir PDF" })).toBeDefined()
    expect(screen.getByText("4 firmados · 12 total")).toBeDefined()
  })
})

describe("HeroCount", () => {
  test("typesets every segment", () => {
    const { container } = render(
      <HeroCount
        segments={[
          { count: 4, label: "firmados" },
          { count: 12, label: "total" },
        ]}
      />
    )

    expect(container.textContent).toBe("4 firmados·12 total")
  })

  test("hides the whole line when the total is zero", () => {
    const { container } = render(
      <HeroCount
        segments={[
          { count: 0, label: "firmados" },
          { count: 0, label: "total" },
        ]}
      />
    )

    expect(container.textContent).toBe("")
  })
})
