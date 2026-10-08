import { getIcon } from "@/lib/icon-registry"

const FolderIcon = getIcon("entities", "folder")

import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import type { DragSourceProps } from "@/features/documents/overview/hooks/use-library-drag"
import {
  type DocumentFolder,
  documentLabels,
  type FolderDropTargetProps,
  folderHref,
} from "@/features/documents/shared"
import { EntityIcon, type EntityIconValue } from "@/features/entity-icons"
import { type IconRef, iconRef } from "@/lib/icon-registry"

export interface FoldersRowContext {
  iconFor: (folder: DocumentFolder) => EntityIconValue | null
  dragSource: (folder: DocumentFolder) => DragSourceProps
  dropTarget: (folderId: string) => FolderDropTargetProps | null
  onEdit: (folder: DocumentFolder) => void
  onMove: (folder: DocumentFolder) => void
  onDelete: (folder: DocumentFolder) => void
}

/** A folder's icon, or the plain folder when it has none. */
export function FolderGlyph({
  value,
  className,
}: {
  value: EntityIconValue | null
  className?: string
}) {
  return (
    <EntityIcon
      value={value}
      fallback={FolderIcon}
      fallbackColor="neutral"
      className={className}
    />
  )
}

type FolderAction = {
  key: string
  label: string
  icon: IconRef
  destructive?: boolean
  onSelect: (folder: DocumentFolder, context: FoldersRowContext) => void
}

/** Folder actions, shared by the list rows and the grid cards. */
export const folderActions: FolderAction[] = [
  {
    key: "edit",
    label: documentLabels.editFolder,
    icon: iconRef("actions", "edit"),
    onSelect: (folder, ctx) => ctx.onEdit(folder),
  },
  {
    key: "move",
    label: documentLabels.move,
    icon: iconRef("actions", "move"),
    onSelect: (folder, ctx) => ctx.onMove(folder),
  },
  {
    key: "delete",
    label: documentLabels.delete,
    icon: iconRef("actions", "delete"),
    destructive: true,
    onSelect: (folder, ctx) => ctx.onDelete(folder),
  },
]

/** A subfolder row in the list view: icon, name and document count. Opening
 *  it navigates into it; it is a drag source and a drop target. */
export const folderDefinition: EntityListDefinition<
  DocumentFolder,
  FoldersRowContext
> = {
  getKey: (folder) => folder.id,
  getAccessibleLabel: (folder) => folder.name,
  getPrimary: (folder, context) => (
    <span className="inline-flex max-w-full items-center gap-2">
      <FolderGlyph
        value={context.iconFor(folder)}
        className="size-4 shrink-0"
      />
      <span className="truncate">{folder.name}</span>
    </span>
  ),
  getSecondary: (folder) => documentLabels.documentCount(folder.documentCount),
  getOpenHref: (folder) => folderHref(folder.id),
  getRowDragProps: (folder, context) => ({
    ...context.dragSource(folder),
    ...context.dropTarget(folder.id),
  }),
  actions: folderActions,
}
