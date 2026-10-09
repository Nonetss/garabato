import { type DragEvent, useRef, useState } from "react"
import {
  type DocumentFolder,
  type DocumentSummary,
  descendantIdsOf,
  type FolderDropTargetProps,
  type FolderIndex,
} from "@/features/documents/shared"
import { useFinePointer } from "@/hooks/use-fine-pointer"

/** Private type, so files dragged in from the desktop are never a move. */
const MOVE_TYPE = "application/x-garabato-move"
const ROOT = "root"

type Payload =
  | { kind: "documents"; ids: string[] }
  | { kind: "folder"; id: string }

export type DragSourceProps = {
  draggable: boolean
  onDragStart?: (event: DragEvent<HTMLElement>) => void
  onDragEnd?: () => void
}

function targetKey(folderId: string | null) {
  if (folderId === null) return ROOT
  return folderId
}

function isMoveDrag(event: DragEvent<HTMLElement>) {
  return event.dataTransfer.types.includes(MOVE_TYPE)
}

/**
 * Native drag and drop for the documents page: documents (the whole
 * selection when the dragged one is selected) and folders are sources;
 * folders and breadcrumb segments are targets. Only on fine pointers, so a
 * touch scroll never starts a drag; "Mover a…" covers everything else.
 */
export function useLibraryDrag({
  index,
  documents,
  selectedIds,
  onMoveDocuments,
  onMoveFolder,
}: {
  index: FolderIndex<DocumentFolder>
  documents: DocumentSummary[]
  selectedIds: string[]
  onMoveDocuments: (ids: string[], folderId: string | null) => void
  onMoveFolder: (id: string, parentId: string | null) => void
}) {
  const enabled = useFinePointer()
  // The payload lives here: `dataTransfer` can't be read until the drop.
  const payload = useRef<Payload | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const end = () => {
    payload.current = null
    setOver(null)
  }

  const start = (event: DragEvent<HTMLElement>, next: Payload) => {
    payload.current = next
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData(MOVE_TYPE, JSON.stringify(next))
  }

  const accepts = (folderId: string | null) => {
    const current = payload.current
    if (!current) return false
    if (current.kind === "folder") {
      const folder = index.byId.get(current.id)
      if (!folder || folder.parentId === folderId) return false
      if (folderId === null) return true
      if (folderId === current.id) return false
      return !descendantIdsOf(index, current.id).has(folderId)
    }
    // Valid while at least one dragged document lives elsewhere.
    const dragged = new Set(current.ids)
    return documents.some(
      (document) => dragged.has(document.id) && document.folderId !== folderId
    )
  }

  const documentSource = (document: DocumentSummary): DragSourceProps => {
    if (!enabled) return { draggable: false }
    return {
      draggable: true,
      onDragStart: (event) => {
        const ids = selectedIds.includes(document.id)
          ? selectedIds
          : [document.id]
        start(event, { kind: "documents", ids })
      },
      onDragEnd: end,
    }
  }

  const folderSource = (folder: DocumentFolder): DragSourceProps => {
    if (!enabled) return { draggable: false }
    return {
      draggable: true,
      onDragStart: (event) => start(event, { kind: "folder", id: folder.id }),
      onDragEnd: end,
    }
  }

  const dropTarget = (
    folderId: string | null
  ): FolderDropTargetProps | null => {
    if (!enabled) return null
    const key = targetKey(folderId)
    return {
      dropActive: over === key,
      onDragEnter: (event) => {
        if (!isMoveDrag(event) || !accepts(folderId)) return
        event.preventDefault()
        setOver(key)
      },
      onDragOver: (event) => {
        if (!isMoveDrag(event) || !accepts(folderId)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
      },
      onDragLeave: (event) => {
        // Moving onto a child of the target is not leaving it.
        const related = event.relatedTarget
        if (related instanceof Node && event.currentTarget.contains(related)) {
          return
        }
        setOver((current) => {
          if (current === key) return null
          return current
        })
      },
      onDrop: (event) => {
        const current = payload.current
        if (!isMoveDrag(event) || !current || !accepts(folderId)) return
        event.preventDefault()
        end()
        if (current.kind === "folder") {
          onMoveFolder(current.id, folderId)
          return
        }
        onMoveDocuments(current.ids, folderId)
      },
    }
  }

  return { enabled, documentSource, folderSource, dropTarget }
}
