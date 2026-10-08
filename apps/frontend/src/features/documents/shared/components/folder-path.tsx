import { getIcon } from "@/lib/icon-registry"

const SeparatorIcon = getIcon("controls", "chevronRight")

import type { DragEventHandler } from "react"
import { Fragment } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { AppLink } from "@/components/ui/app-link"
import { documentLabels } from "@/features/documents/shared/definitions/document-labels"
import {
  type FolderIndex,
  pathOf,
} from "@/features/documents/shared/model/folder-tree"
import { folderHref } from "@/features/documents/shared/model/library"
import type { DocumentFolder } from "@/features/documents/shared/model/types"
import { cn } from "@/lib/utils"

/** A folder (or the root, `null`) as a drop target for dragged items. */
export interface FolderDropTargetProps {
  onDragEnter: DragEventHandler<HTMLElement>
  onDragOver: DragEventHandler<HTMLElement>
  onDragLeave: DragEventHandler<HTMLElement>
  onDrop: DragEventHandler<HTMLElement>
  dropActive: boolean
}

/**
 * Breadcrumbs from "Documentos" (the root) to `folderId`, each linking to
 * that folder on the documents page. With `currentIsLink={false}` the last
 * segment is the current page instead of a link. `getDropTarget` turns each
 * segment into a drop target (the documents page, on pointer devices).
 */
export function FolderPath({
  index,
  folderId,
  currentIsLink = true,
  getDropTarget,
  className,
}: {
  index: FolderIndex<DocumentFolder>
  folderId: string | null
  currentIsLink?: boolean
  getDropTarget?: (folderId: string | null) => FolderDropTargetProps | null
  className?: string
}) {
  const segments: { id: string | null; name: string }[] = [
    { id: null, name: documentLabels.root },
    ...pathOf(index, folderId).map((folder) => ({
      id: folder.id,
      name: folder.name,
    })),
  ]

  return (
    <nav
      aria-label={documentLabels.folderPath}
      className={cn("min-w-0", className)}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
        {segments.map((segment, position) => {
          const isLast = position === segments.length - 1
          const { dropActive, ...dropHandlers } = getDropTarget?.(
            segment.id
          ) ?? { dropActive: false }
          return (
            <Fragment key={segment.id ?? "root"}>
              {position > 0 ? (
                <li aria-hidden className="text-muted-foreground">
                  <SeparatorIcon className="size-3.5" />
                </li>
              ) : null}
              <li
                {...dropHandlers}
                className={cn(
                  "min-w-0 rounded-md px-1.5 py-0.5 transition-colors",
                  dropActive && "bg-muted ring-2 ring-ring/50"
                )}
              >
                {isLast && !currentIsLink ? (
                  <Text
                    variant="title"
                    aria-current="page"
                    className="block max-w-56 truncate"
                  >
                    {segment.name}
                  </Text>
                ) : (
                  <AppLink
                    href={folderHref(segment.id)}
                    className={cn(
                      textVariants({ role: "body", tone: "muted" }),
                      "block max-w-56 truncate hover:text-foreground hover:underline"
                    )}
                  >
                    {segment.name}
                  </AppLink>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
