import { getIcon } from "@/lib/icon-registry"

export type ThemeMode = "light" | "dark" | "system"

const THEME_STORAGE_KEY = "theme"

function prefersDarkScheme(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? (prefersDarkScheme() ? "dark" : "light") : mode
}

/** Absence of a stored value means "system" — the default, set by `Layout.astro` / `Admin.astro`. */
export function getStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === "light" || stored === "dark" ? stored : "system"
}

export function applyThemeMode(mode: ThemeMode): void {
  if (mode === "system") {
    localStorage.removeItem(THEME_STORAGE_KEY)
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  }
  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(mode) === "dark"
  )
}

const Sun = getIcon("theme", "lightTheme")
const Moon = getIcon("theme", "darkTheme")
const Monitor = getIcon("theme", "systemTheme")

export interface ThemeModeOption {
  value: ThemeMode
  label: string
  description: string
  icon: typeof Sun
}

export const themeModeOptions: ThemeModeOption[] = [
  {
    value: "system",
    label: "Sistema",
    description: "Sigue el ajuste de tu dispositivo.",
    icon: Monitor,
  },
  {
    value: "light",
    label: "Claro",
    description: "Usa siempre el tema claro.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Oscuro",
    description: "Usa siempre el tema oscuro.",
    icon: Moon,
  },
]
