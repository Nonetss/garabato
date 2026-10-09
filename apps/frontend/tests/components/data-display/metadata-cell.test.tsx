import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import {
  MetadataCell,
  MetadataDefinitionList,
} from "@/components/shared/data-display/metadata-cell"

afterEach(cleanup)

describe("MetadataCell", () => {
  test("sets the value in the body role under the label", () => {
    render(<MetadataCell label="Rol">Administrador</MetadataCell>)
    const value = screen.getByText("Administrador")

    expect(screen.getByText("Rol").className).toContain("uppercase")
    expect(value.className).toContain("text-body")
    expect(value.className).not.toContain("text-destructive")
  })

  test("a destructive tone reaches the value, not the label", () => {
    render(
      <MetadataCell label="Estado" tone="destructive">
        Bloqueado
      </MetadataCell>
    )

    expect(screen.getByText("Bloqueado").className).toContain(
      "text-destructive"
    )
    expect(screen.getByText("Estado").className).toContain(
      "text-muted-foreground"
    )
  })

  test("as a definition list it emits dt and dd", () => {
    render(
      <MetadataDefinitionList
        columns={2}
        context={{ name: "Ada" }}
        fields={[
          { key: "name", label: "Nombre", value: ({ name }) => name },
          {
            key: "hidden",
            label: "Oculto",
            value: () => "nunca",
            hidden: () => true,
          },
        ]}
      />
    )

    expect(screen.getByText("Nombre").tagName).toBe("DT")
    expect(screen.getByText("Ada").tagName).toBe("DD")
    expect(screen.queryByText("Oculto")).toBeNull()
  })
})
