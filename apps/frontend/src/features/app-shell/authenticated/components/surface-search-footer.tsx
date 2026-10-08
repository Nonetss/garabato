import { Text } from "@/components/shared/brand/typography"
import { CommandFooter } from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

const KEY_HINTS = [
  { keys: ["↑", "↓"], label: "navegar" },
  { keys: ["↵"], label: "abrir" },
  { keys: ["esc"], label: "cerrar" },
]

/**
 * Keyboard legend under the surface search results. Hidden on small
 * screens, where the palette is driven by touch.
 */
export function SurfaceSearchFooter() {
  return (
    <CommandFooter aria-hidden className="hidden sm:flex">
      {KEY_HINTS.map((hint) => (
        <span key={hint.label} className="inline-flex items-center gap-1.5">
          <KbdGroup>
            {hint.keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
          <Text variant="compact" tone="muted">
            {hint.label}
          </Text>
        </span>
      ))}
    </CommandFooter>
  )
}
