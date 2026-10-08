import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { applyThemeMode, getStoredThemeMode, resolveTheme } from "@/lib/theme"

/** Answers `prefers-color-scheme` with `matches` until the spy is restored. */
function prefersDark(matches: boolean) {
  const matchMedia = window.matchMedia.bind(window)
  return spyOn(window, "matchMedia").mockImplementation((query: string) =>
    Object.defineProperty(matchMedia(query), "matches", { value: matches })
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove("dark")
})

afterEach(() => {
  localStorage.clear()
})

describe("theme", () => {
  test("an explicit mode resolves to itself", () => {
    expect(resolveTheme("light")).toBe("light")
    expect(resolveTheme("dark")).toBe("dark")
  })

  test("system mode follows the OS preference", () => {
    const spy = prefersDark(true)
    expect(resolveTheme("system")).toBe("dark")
    spy.mockRestore()
  })

  test("applying a mode stores it and toggles the dark class", () => {
    applyThemeMode("dark")
    expect(getStoredThemeMode()).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  test("system mode clears the stored value", () => {
    const spy = prefersDark(false)
    applyThemeMode("light")
    applyThemeMode("system")
    expect(localStorage.getItem("theme")).toBeNull()
    expect(getStoredThemeMode()).toBe("system")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    spy.mockRestore()
  })
})
