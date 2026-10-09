import { getIcon } from "@/lib/icon-registry"

const CloseIcon = getIcon("controls", "close")
const MoveIcon = getIcon("actions", "move")
const TagsIcon = getIcon("actions", "tags")
const PinIcon = getIcon("actions", "pin")
const UnpinIcon = getIcon("actions", "unpin")
const DeleteIcon = getIcon("actions", "delete")
const MergeIcon = getIcon("actions", "merge")

import type { ComponentType, ReactNode } from "react"
import { Text } from "@/components/shared/brand/typography"
import { IconButton } from "@/components/shared/form/icon-button"
import { Button } from "@/components/ui/button"
import { documentLabels } from "@/features/documents/shared"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

// Icon-only on narrow viewports, a 44px cell each, labelled from `md`.
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
        size="icon"
        className={cn("h-11 w-full", className)}
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

type BarActionEntry = {
  key: string
  label: string
  Icon: ComponentType<{ className?: string }>
  onClick: () => void
}

/**
 * The actions for the selected documents, fixed to the bottom edge while a
 * selection exists. On narrow viewports it takes the filter bar's place:
 * the count on one line, the actions below as an even row of 44px icon
 * cells (up to seven never fit beside the count on a phone).
 */
export function SelectionBar({
  count,
  onMove,
  onTags,
  onPin,
  onUnpin,
  onMerge,
  onDelete,
  onClear,
}: {
  count: number
  onMove: () => void
  onTags: () => void
  onPin: () => void
  onUnpin: () => void
  onMerge: () => void
  onDelete: () => void
  onClear: () => void
}) {
  const compact = useIsMobile()
  if (count === 0) return null

  const actions: BarActionEntry[] = [
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
  // Merging needs at least two documents.
  if (count >= 2) {
    actions.push({
      key: "merge",
      label: documentLabels.merge,
      Icon: MergeIcon,
      onClick: onMerge,
    })
  }

  // A full-width row of equal cells below the count on narrow viewports.
  const actionsClass = compact
    ? "grid w-full auto-cols-fr grid-flow-col"
    : "ml-auto flex items-center gap-1"

  const deleteAction = (
    <BarAction
      label={documentLabels.delete}
      Icon={DeleteIcon}
      onClick={onDelete}
      compact={compact}
      className="text-destructive hover:text-destructive"
    />
  )

  return (
    <div
      role="toolbar"
      aria-label={documentLabels.selectedCount(count)}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pt-2 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(0.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] backdrop-blur-sm md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:rounded-lg md:border md:px-4 md:pt-3 md:pb-3 md:shadow-lg"
    >
      <div className="flex flex-wrap items-center gap-1 md:flex-nowrap">
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
        <div className={actionsClass}>
          {actions.map(({ key, label, Icon, onClick }) => (
            <BarAction
              key={key}
              label={label}
              Icon={Icon}
              onClick={onClick}
              compact={compact}
            />
          ))}
          {deleteAction}
        </div>
      </div>
    </div>
  )
}
