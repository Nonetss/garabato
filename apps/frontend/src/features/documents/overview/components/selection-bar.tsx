import { getIcon } from "@/lib/icon-registry"

const CloseIcon = getIcon("controls", "close")
const MoveIcon = getIcon("actions", "move")
const TagsIcon = getIcon("actions", "tags")
const PinIcon = getIcon("actions", "pin")
const UnpinIcon = getIcon("actions", "unpin")
const DeleteIcon = getIcon("actions", "delete")

import type { ComponentType, ReactNode } from "react"
import { Text } from "@/components/shared/brand/typography"
import { IconButton } from "@/components/shared/form/icon-button"
import { Button } from "@/components/ui/button"
import { documentLabels } from "@/features/documents/shared"
import { useIsMobile } from "@/hooks/use-mobile"

// Icon-only (named with `Hint`) on narrow viewports, labelled from `md`.
function BarAction({
  label,
  Icon,
  onClick,
  compact,
  className,
}: {
  label: string
  Icon: ComponentType<{ className?: string }>
  onClick: () => void
  compact: boolean
  className?: string
}): ReactNode {
  if (compact) {
    return (
      <IconButton
        label={label}
        icon={Icon}
        onClick={onClick}
        className={className}
      />
    )
  }
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className={className}>
      <Icon />
      {label}
    </Button>
  )
}

/**
 * The actions for the selected documents, fixed to the bottom edge while a
 * selection exists. On narrow viewports it takes the filter bar's place
 * and its buttons collapse to icons named with `Hint`.
 */
export function SelectionBar({
  count,
  onMove,
  onTags,
  onPin,
  onUnpin,
  onDelete,
  onClear,
}: {
  count: number
  onMove: () => void
  onTags: () => void
  onPin: () => void
  onUnpin: () => void
  onDelete: () => void
  onClear: () => void
}) {
  const compact = useIsMobile()
  if (count === 0) return null

  const actions = [
    {
      key: "move",
      label: documentLabels.move,
      Icon: MoveIcon,
      onClick: onMove,
    },
    {
      key: "tags",
      label: documentLabels.tags,
      Icon: TagsIcon,
      onClick: onTags,
    },
    { key: "pin", label: documentLabels.pin, Icon: PinIcon, onClick: onPin },
    {
      key: "unpin",
      label: documentLabels.unpin,
      Icon: UnpinIcon,
      onClick: onUnpin,
    },
  ]

  return (
    <div
      role="toolbar"
      aria-label={documentLabels.selectedCount(count)}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:rounded-lg md:border md:pb-3 md:shadow-lg"
    >
      <div className="flex items-center gap-1">
        <IconButton
          label={documentLabels.clearSelection}
          icon={CloseIcon}
          onClick={onClear}
        />
        <Text
          variant="title"
          aria-live="polite"
          className="mr-2 whitespace-nowrap tabular-nums"
        >
          {documentLabels.selectedCount(count)}
        </Text>
        <div className="ml-auto flex items-center gap-1">
          {actions.map(({ key, label, Icon, onClick }) => (
            <BarAction
              key={key}
              label={label}
              Icon={Icon}
              onClick={onClick}
              compact={compact}
            />
          ))}
          <BarAction
            label={documentLabels.delete}
            Icon={DeleteIcon}
            onClick={onDelete}
            compact={compact}
            className="text-destructive hover:text-destructive"
          />
        </div>
      </div>
    </div>
  )
}
