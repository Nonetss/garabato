import { DynamicIcon, type IconName, iconNames } from "lucide-react/dynamic"
import type { ComponentType } from "react"
import { useEntityIcons } from "@/features/entity-icons/picker/hooks/use-entity-icons"
import {
  DEFAULT_ICON_COLOR,
  ICON_PALETTE,
} from "@/features/entity-icons/picker/model/palette"
import type {
  EntityIconColor,
  EntityIconRef,
  EntityIconValue,
} from "@/features/entity-icons/picker/model/types"
import { cn } from "@/lib/utils"

const knownIcons = new Set<string>(iconNames)

function isIconName(name: string): name is IconName {
  return knownIcons.has(name)
}

type FallbackIcon = ComponentType<{ className?: string }>

interface IconGlyphProps {
  value: EntityIconValue | null
  /** Shown when there is no icon, while it loads, or for unknown names. */
  fallback: FallbackIcon
  /** Color of the fallback icon; the palette default when omitted. */
  fallbackColor?: EntityIconColor
  className?: string
}

/**
 * Draws an icon value in its palette color. Only the icon's own chunk is
 * downloaded, never the picker catalog. Needs no query client.
 */
export function IconGlyph({
  value,
  fallback: Fallback,
  fallbackColor = DEFAULT_ICON_COLOR,
  className,
}: IconGlyphProps) {
  const renderFallback = () => (
    <Fallback
      aria-hidden
      className={cn(ICON_PALETTE[fallbackColor].text, className)}
    />
  )

  if (!value || !isIconName(value.icon)) return renderFallback()

  return (
    <DynamicIcon
      name={value.icon}
      aria-hidden
      className={cn(ICON_PALETTE[value.color].text, className)}
      fallback={renderFallback}
    />
  )
}

function LoadedEntityIcon({
  entity,
  ...props
}: Omit<IconGlyphProps, "value"> & { entity: EntityIconRef }) {
  const { iconFor } = useEntityIcons([entity])
  return <IconGlyph value={iconFor(entity)} {...props} />
}

type EntityIconProps = Omit<IconGlyphProps, "value"> &
  (
    | {
        /** Already-loaded icon (e.g. from `useEntityIcons`). */
        value: EntityIconValue | null
        entity?: never
      }
    | {
        /** Entity whose icon is loaded on its own. */
        entity: EntityIconRef
        value?: never
      }
  )

/**
 * An entity's chosen icon, or `fallback` when it has none. Pass `value` when
 * a list already loaded icons in batch, or `entity` to load just this one.
 */
export function EntityIcon({ value, entity, ...props }: EntityIconProps) {
  if (entity) return <LoadedEntityIcon entity={entity} {...props} />
  return <IconGlyph value={value ?? null} {...props} />
}
