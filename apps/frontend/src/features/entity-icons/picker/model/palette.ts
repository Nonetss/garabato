import type { EntityIconColor } from "@/features/entity-icons/picker/model/types"

export const DEFAULT_ICON_COLOR: EntityIconColor = "orange"

type PaletteEntry = {
  label: string
  /** Text color for the icon itself. */
  text: string
  /** Fill for the color swatch. */
  swatch: string
}

/**
 * Exhaustive over the API's color keys: a key added on the server fails
 * type-checking here until it gets a token in `global.css` and an entry.
 */
export const ICON_PALETTE: Record<EntityIconColor, PaletteEntry> = {
  orange: {
    label: "Naranja",
    text: "text-icon-orange",
    swatch: "bg-icon-orange",
  },
  amber: { label: "Ámbar", text: "text-icon-amber", swatch: "bg-icon-amber" },
  green: { label: "Verde", text: "text-icon-green", swatch: "bg-icon-green" },
  teal: { label: "Turquesa", text: "text-icon-teal", swatch: "bg-icon-teal" },
  blue: { label: "Azul", text: "text-icon-blue", swatch: "bg-icon-blue" },
  violet: {
    label: "Violeta",
    text: "text-icon-violet",
    swatch: "bg-icon-violet",
  },
  rose: { label: "Rosa", text: "text-icon-rose", swatch: "bg-icon-rose" },
  neutral: {
    label: "Gris",
    text: "text-icon-neutral",
    swatch: "bg-icon-neutral",
  },
}

export const ICON_COLORS = Object.keys(ICON_PALETTE) as EntityIconColor[]
