import { describe, expect, test } from "bun:test"
import { foldText, textSuggestions } from "@/lib/fold-text"

describe("foldText", () => {
  test("lower-cases and strips diacritics", () => {
    expect(foldText("Árbol Ñandú ÉXITO")).toBe("arbol nandu exito")
  })
})

describe("textSuggestions", () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `id-${index}`,
    name: `Organización ${index}`,
  }))
  const options = {
    match: (item: { name: string }, query: string) =>
      foldText(item.name).includes(query),
    toItem: (item: { id: string; name: string }) => ({
      key: item.id,
      value: item.id,
      label: item.name,
    }),
  }

  test("matches an accent-insensitive query and caps at 8 by default", () => {
    const suggestions = textSuggestions(items, "  ORGANIZACION ", options)
    expect(suggestions).toHaveLength(8)
    expect(suggestions[0]).toEqual({
      key: "id-0",
      value: "id-0",
      label: "Organización 0",
    })
  })

  test("honours a custom limit", () => {
    expect(
      textSuggestions(items, "organiz", { ...options, limit: 2 })
    ).toHaveLength(2)
  })

  test("returns nothing for a blank query", () => {
    expect(textSuggestions(items, "   ", options)).toEqual([])
  })
})
