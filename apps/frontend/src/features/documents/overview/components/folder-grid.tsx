import { Fragment } from "react"
import { Text } from "@/components/shared/brand/typography"
import { RowActionsMenu } from "@/components/shared/data-display/row-actions-menu"
import { AppLink } from "@/components/ui/app-link"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  FolderGlyph,
  type FoldersRowContext,
  folderActions,
} from "@/features/documents/overview/definitions/folder.definition"
import {
  type DocumentFolder,
  documentLabels,
  folderHref,
} from "@/features/documents/shared"
import { resolveIconRef } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

function FolderCard({
  folder,
  context,
}: {
  folder: DocumentFolder
  context: FoldersRowContext
}) {
  const { dropActive, ...dropHandlers } = context.dropTarget(folder.id) ?? {
    dropActive: false,
  }
  return (
    <li
      {...context.dragSource(folder)}
      {...dropHandlers}
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/40",
        dropActive && "bg-muted ring-2 ring-ring/50"
      )}
    >
      <AppLink
        href={folderHref(folder.id)}
        className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:underline"
      >
        <FolderGlyph
          value={context.iconFor(folder)}
          className="size-5 shrink-0"
        />
        <span className="min-w-0">
          <Text as="span" variant="title" className="block truncate">
            {folder.name}
          </Text>
          <Text
            as="span"
            variant="compact"
            tone="muted"
            className="block tabular-nums"
          >
            {documentLabels.documentCount(folder.documentCount)}
          </Text>
        </span>
      </AppLink>
      <RowActionsMenu label={`Acciones de ${folder.name}`}>
        {folderActions.map((action) => {
          const Icon = resolveIconRef(action.icon)
          return (
            <Fragment key={action.key}>
              {action.destructive ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant={action.destructive ? "destructive" : undefined}
                onClick={() => action.onSelect(folder, context)}
              >
                <Icon className="size-4" />
                {action.label}
              </DropdownMenuItem>
            </Fragment>
          )
        })}
      </RowActionsMenu>
    </li>
  )
}

/** The open folder's subfolders above the document sheets. */
export function FolderGrid({
  folders,
  context,
}: {
  folders: DocumentFolder[]
  context: FoldersRowContext
}) {
  if (folders.length === 0) return null
  return (
    <div className="@container">
      <ul className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4">
        {folders.map((folder) => (
          <FolderCard key={folder.id} folder={folder} context={context} />
        ))}
      </ul>
    </div>
  )
}
