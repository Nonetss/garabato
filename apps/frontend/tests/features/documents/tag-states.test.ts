import { describe, expect, test } from "bun:test"
import {
  initialTagStates,
  type TagState,
  tagChanges,
} from "@/features/documents/shared/model/tag-states"

describe("initialTagStates", () => {
  test("marks tags on every document as on and the rest as mixed", () => {
    const states = initialTagStates([
      { tagIds: ["urgente", "clientes"] },
      { tagIds: ["urgente"] },
    ])
    expect(Object.fromEntries(states)).toEqual({
      urgente: "on",
      clientes: "mixed",
    })
  })

  test("is empty for documents without tags", () => {
    expect(initialTagStates([{ tagIds: [] }]).size).toBe(0)
  })
})

describe("tagChanges", () => {
  const initial = new Map<string, TagState>([
    ["urgente", "on"],
    ["clientes", "mixed"],
  ])

  test("adds what was turned on and removes what was turned off", () => {
    const draft = new Map<string, TagState>([
      ["urgente", "off"],
      ["clientes", "on"],
      ["nuevo", "on"],
    ])
    expect(tagChanges(initial, draft)).toEqual({
      add: ["clientes", "nuevo"],
      remove: ["urgente"],
    })
  })

  test("leaves untouched and still-mixed tags alone", () => {
    expect(tagChanges(initial, new Map(initial))).toEqual({
      add: [],
      remove: [],
    })
  })
})
