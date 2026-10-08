import { getIcon } from "@/lib/icon-registry"

const FolderIcon = getIcon("entities", "folder")
const RootIcon = getIcon("navigation", "documents")

import { type ReactNode, type SyntheticEvent, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { documentLabels } from "@/features/documents/shared/definitions/document-labels"
import { useDocumentFolders } from "@/features/documents/shared/hooks/use-document-folders"
import {
  buildFolderIndex,
  flattenTree,
} from "@/features/documents/shared/model/folder-tree"
import { folderIconRef } from "@/features/documents/shared/model/library"
import { EntityIcon, useEntityIcons } from "@/features/entity-icons"
import { useOnOpen } from "@/hooks/use-on-open"
import { cn } from "@/lib/utils"

const RADIO_NAME = "move-destination"

function DestinationOption({
  value,
  selected,
  disabled,
  depth,
  onSelect,
  icon,
  label,
}: {
  value: string
  selected: boolean
  disabled: boolean
  depth: number
  onSelect: () => void
  icon: ReactNode
  label: string
}) {
  const id = `${RADIO_NAME}-${value}`
  return (
    <div>
      <input
        type="radio"
        id={id}
        name={RADIO_NAME}
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
        className={cn(
          "flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md py-2 pr-3 transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-40",
          "peer-checked:bg-muted",
          !(selected || disabled) && "hover:bg-muted/50"
        )}
      >
        {icon}
        <Text variant="title" className="truncate">
          {label}
        </Text>
      </label>
    </div>
  )
}

/**
 * Picks where to move documents or a folder: the library root first, then
 * the folder tree. `isDisabled` greys out destinations that make no sense
 * (where everything already is, a folder itself and its descendants).
 */
export function MoveToFolderDialog({
  open,
  onOpenChange,
  title,
  isDisabled,
  onMove,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  isDisabled: (folderId: string | null) => boolean
  onMove: (folderId: string | null) => Promise<unknown>
  isPending: boolean
}) {
  const { data: folders = [] } = useDocumentFolders()
  const index = buildFolderIndex(folders)
  const rows = flattenTree(index)
  const { iconFor } = useEntityIcons(
    folders.map((folder) => folderIconRef(folder.id))
  )
  // `undefined` until the user picks one: the root is a valid destination.
  const [destination, setDestination] = useState<string | null | undefined>(
    undefined
  )

  useOnOpen(open, () => setDestination(undefined))

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (destination === undefined) return
    await onMove(destination)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onSubmit={handleSubmit}
      isPending={isPending}
      submitLabel={documentLabels.moveSubmit}
      submitDisabled={destination === undefined}
    >
      <fieldset className="-mx-2 my-0 max-h-80 min-w-0 overflow-y-auto border-0 p-0">
        <legend className="sr-only">{documentLabels.folder}</legend>
        <DestinationOption
          value="root"
          selected={destination === null}
          disabled={isDisabled(null)}
          depth={0}
          onSelect={() => setDestination(null)}
          icon={<RootIcon aria-hidden className="size-4 shrink-0" />}
          label={documentLabels.root}
        />
        {rows.map(({ folder, depth }) => (
          <DestinationOption
            key={folder.id}
            value={folder.id}
            selected={destination === folder.id}
            disabled={isDisabled(folder.id)}
            depth={depth + 1}
            onSelect={() => setDestination(folder.id)}
            icon={
              <EntityIcon
                value={iconFor(folderIconRef(folder.id))}
                fallback={FolderIcon}
                fallbackColor="neutral"
                className="size-4 shrink-0"
              />
            }
            label={folder.name}
          />
        ))}
      </fieldset>
    </FormDialog>
  )
}
