import { Hint } from "@/components/shared/feedback/hint"
import {
  ICON_COLORS,
  ICON_PALETTE,
} from "@/features/entity-icons/picker/model/palette"
import type { EntityIconColor } from "@/features/entity-icons/picker/model/types"
import { cn } from "@/lib/utils"

interface IconColorSwatchesProps {
  value: EntityIconColor
  onChange: (color: EntityIconColor) => void
}

export function IconColorSwatches({ value, onChange }: IconColorSwatchesProps) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Color</legend>
      {ICON_COLORS.map((color) => {
        const { label, swatch } = ICON_PALETTE[color]
        const checked = color === value
        return (
          <Hint key={color} label={label}>
            <button
              type="button"
              aria-pressed={checked}
              aria-label={label}
              className={cn(
                "size-6 rounded-full outline-none transition-shadow",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
                swatch,
                checked &&
                  "ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover"
              )}
              onClick={() => onChange(color)}
            />
          </Hint>
        )
      })}
    </fieldset>
  )
}
