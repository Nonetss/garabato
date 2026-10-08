import { getIcon } from "@/lib/icon-registry"

const MoreIcon = getIcon("views", "overflowMenu")
const MoveIcon = getIcon("actions", "move")
const TagsIcon = getIcon("actions", "tags")
const PinIcon = getIcon("actions", "pin")
const UnpinIcon = getIcon("actions", "unpin")

import { useMemo, useState } from "react"
import { Hint } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  buildFolderIndex,
  type DocumentDetail,
  DocumentTagsDialog,
  documentLabels,
  FolderPath,
  MoveToFolderDialog,
  TagChips,
  useDocumentFolders,
  useDocumentsMove,
  useDocumentsSetPinned,
  useDocumentTags,
} from "@/features/documents/shared"

const MORE_ACTIONS = "Más acciones"

/** Where the document lives (each segment links to the folder) and its tags. */
export function DocumentPlacement({ document }: { document: DocumentDetail }) {
  const { data: folders = [] } = useDocumentFolders()
  const { data: tags = [] } = useDocumentTags()
  const index = useMemo(() => buildFolderIndex(folders), [folders])
  const tagsById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags]
  )

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <FolderPath index={index} folderId={document.folderId} />
      <TagChips tagIds={document.tagIds} tags={tagsById} max={6} />
    </div>
  )
}

/** "Mover a…", "Etiquetas" and pinning, behind an overflow menu. */
export function DocumentOrganizationMenu({
  document,
}: {
  document: DocumentDetail
}) {
  const move = useDocumentsMove()
  const setPinned = useDocumentsSetPinned()
  const [moveOpen, setMoveOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const pinned = document.pinnedAt !== null

  return (
    <>
      <DropdownMenu>
        <Hint label={MORE_ACTIONS}>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon" aria-label={MORE_ACTIONS} />
            }
          >
            <MoreIcon className="size-4" />
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setMoveOpen(true)}>
            <MoveIcon className="size-4" />
            {documentLabels.move}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTagsOpen(true)}>
            <TagsIcon className="size-4" />
            {documentLabels.tags}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              setPinned.mutate({ ids: [document.id], pinned: !pinned })
            }
          >
            {pinned ? (
              <UnpinIcon className="size-4" />
            ) : (
              <PinIcon className="size-4" />
            )}
            {pinned ? documentLabels.unpin : documentLabels.pin}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={documentLabels.moveTitle(1)}
        isDisabled={(folderId) => folderId === document.folderId}
        onMove={(folderId) =>
          move.mutateAsync({ ids: [document.id], folderId })
        }
        isPending={move.isPending}
      />
      <DocumentTagsDialog
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        documents={[document]}
      />
    </>
  )
}
