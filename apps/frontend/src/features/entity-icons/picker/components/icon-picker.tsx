import { type ComponentType, useState } from "react"
import { Hint } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { IconGlyph } from "@/features/entity-icons/picker/components/entity-icon"
import { IconPickerPanel } from "@/features/entity-icons/picker/components/icon-picker-panel"
import type { IconCategoryId } from "@/features/entity-icons/picker/model/icon-categories.generated"
import { DEFAULT_ICON_COLOR } from "@/features/entity-icons/picker/model/palette"
import type {
  EntityIconColor,
  EntityIconValue,
} from "@/features/entity-icons/picker/model/types"
import { getIcon } from "@/lib/icon-registry"

const PickIcon = getIcon("actions", "pickIcon")

export interface IconPickerProps {
  value: EntityIconValue | null
  onChange: (value: EntityIconValue | null) => void
  /**
   * `popover` (default) opens a compact panel next to the trigger; `dialog`
   * opens a larger one in a centered modal.
   */
  variant?: "popover" | "dialog"
  /** Lucide categories this screen offers; every category when omitted. */
  categories?: readonly IconCategoryId[]
  /** Icon the trigger shows when there is no value. */
  fallback?: ComponentType<{ className?: string }>
  /**
   * Whether the user can choose the color. When `false` the swatches are
   * hidden and every pick is saved with `defaultColor`.
   */
  allowColor?: boolean
  /** Color preselected for new icons (and the only one without `allowColor`). */
  defaultColor?: EntityIconColor
  /** Accessible name of the trigger, and the dialog's title. */
  label?: string
  disabled?: boolean
  id?: string
  className?: string
}

/**
 * Controlled Lucide icon + color picker. It knows nothing about entities:
 * `EntityIconPicker` binds it to one, forms can hold the value themselves.
 */
export function IconPicker({
  value,
  onChange,
  variant = "popover",
  categories,
  fallback = PickIcon,
  allowColor = true,
  defaultColor = DEFAULT_ICON_COLOR,
  label = "Elegir icono",
  disabled,
  id,
  className,
}: IconPickerProps) {
  const [open, setOpen] = useState(false)

  const triggerButton = (
    <Button
      id={id}
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      disabled={disabled}
      className={className}
    />
  )
  const triggerGlyph = (
    <IconGlyph
      value={value}
      fallback={fallback}
      fallbackColor={defaultColor}
      className="size-5"
    />
  )
  const panelProps = { value, onChange, categories, allowColor, defaultColor }

  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Hint label={label}>
          <DialogTrigger render={triggerButton}>{triggerGlyph}</DialogTrigger>
        </Hint>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Busca por nombre o etiqueta y filtra por categoría.
            </DialogDescription>
          </DialogHeader>
          <IconPickerPanel {...panelProps} size="large" />
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>
              Hecho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label={label}>
        <PopoverTrigger render={triggerButton}>{triggerGlyph}</PopoverTrigger>
      </Hint>
      <PopoverContent align="start" className="w-[23rem] p-3">
        <IconPickerPanel {...panelProps} size="compact" />
      </PopoverContent>
    </Popover>
  )
}
