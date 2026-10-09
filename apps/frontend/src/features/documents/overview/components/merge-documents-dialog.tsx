import { getIcon } from "@/lib/icon-registry"

const GripIcon = getIcon("controls", "grip")
const MoveUpIcon = getIcon("actions", "moveUp")
const MoveDownIcon = getIcon("actions", "moveDown")

import { type DragEvent, type SyntheticEvent, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { IconButton } from "@/components/shared/form/icon-button"
import {
  defaultMergeName,
  mergeRequest,
} from "@/features/documents/overview/model/merge"
import {
  type DocumentSummary,
  documentLabels,
  moveItem,
  useDocumentMerge,
} from "@/features/documents/shared"
import { useDialogForm } from "@/hooks/use-dialog-form"
import { useOnOpen } from "@/hooks/use-on-open"
import { cn } from "@/lib/utils"

interface MergeValues {
  name: string
}

const PDF_EXTENSION = /\.pdf$/i

// The API keeps names under 200 characters including `.pdf`.
const fields: DialogFieldDescriptor<MergeValues>[] = [
  {
    kind: "text",
    key: "name",
    label: documentLabels.mergeName,
    hint: documentLabels.nameHint,
    required: true,
    maxLength: 196,
  },
]

function OrderRow({
  document,
  position,
  total,
  dropTarget,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  onMove,
}: {
  document: DocumentSummary
  position: number
  total: number
  dropTarget: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onDrop: () => void
  onDragEnd: () => void
  onMove: (to: number) => void
}) {
  const handleDragStart = (event: DragEvent<HTMLLIElement>) => {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", document.id)
    onDragStart()
  }
  const handleDragOver = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }
  const handleDrop = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault()
    onDrop()
  }

  return (
    <li
      draggable
      onDragStart={handleDragStart}
      onDragEnter={onDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-md border bg-card px-2 py-1.5 active:cursor-grabbing",
        dropTarget && "border-primary ring-2 ring-primary/30"
      )}
    >
      <GripIcon className="size-4 shrink-0 text-muted-foreground" />
      <Text variant="meta" tone="muted" className="w-5 shrink-0 tabular-nums">
        {position + 1}
      </Text>
      <Text variant="title" className="min-w-0 flex-1 truncate">
        {document.name}
      </Text>
      <IconButton
        label={documentLabels.moveUp}
        accessibleLabel={`${documentLabels.moveUp} ${document.name}`}
        icon={MoveUpIcon}
        disabled={position === 0}
        onClick={() => onMove(position - 1)}
      />
      <IconButton
        label={documentLabels.moveDown}
        accessibleLabel={`${documentLabels.moveDown} ${document.name}`}
        icon={MoveDownIcon}
        disabled={position === total - 1}
        onClick={() => onMove(position + 1)}
      />
    </li>
  )
}

interface MergeDocumentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The selected documents, in the order the page lists them. */
  documents: DocumentSummary[]
  /** Where the new document goes; null for the library root. */
  folderId: string | null
  /** `folderId`'s path, empty for the root. */
  folderPath: string
  onMerged: (document: DocumentSummary) => void
}

/**
 * Joins the selected documents, in an order the user can change by dragging
 * or with the move buttons, into a new document in the open folder. The
 * error stays in the dialog, which stays open.
 */
export function MergeDocumentsDialog({
  open,
  onOpenChange,
  documents,
  folderId,
  folderPath,
  onMerged,
}: MergeDocumentsDialogProps) {
  const merge = useDocumentMerge()
  const [order, setOrder] = useState(documents)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const form = useDialogForm(
    open,
    { name: "" },
    { name: defaultMergeName(documents) }
  )

  useOnOpen(open, () => setOrder(documents))

  // Closing forgets the last error, so the next opening starts clean.
  const handleOpenChange = (next: boolean) => {
    if (!next) merge.reset()
    onOpenChange(next)
  }

  const endDrag = () => {
    setDragFrom(null)
    setDragOver(null)
  }

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    merge.mutate(mergeRequest(order, form.trimmed().name, folderId), {
      onSuccess: (document) => {
        handleOpenChange(false)
        onMerged(document)
      },
    })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={documentLabels.mergeTitle(order.length)}
      description={documentLabels.mergeDescription}
      onSubmit={handleSubmit}
      isPending={merge.isPending}
      submitDisabled={
        order.length < 2 || !form.values.name.replace(PDF_EXTENSION, "").trim()
      }
      submitLabel={documentLabels.mergeSubmit}
      form={form}
      fields={fields}
    >
      <div className="space-y-2">
        <Text as="h3" variant="label" tone="muted">
          {documentLabels.mergeOrder}
        </Text>
        <ol className="space-y-1.5">
          {order.map((document, position) => (
            <OrderRow
              key={document.id}
              document={document}
              position={position}
              total={order.length}
              dropTarget={dragFrom !== null && dragOver === position}
              onDragStart={() => setDragFrom(position)}
              onDragEnter={() => setDragOver(position)}
              onDrop={() => {
                if (dragFrom !== null) {
                  setOrder((current) => moveItem(current, dragFrom, position))
                }
                endDrag()
              }}
              onDragEnd={endDrag}
              onMove={(to) =>
                setOrder((current) => moveItem(current, position, to))
              }
            />
          ))}
        </ol>
        <Text variant="meta" tone="muted">
          {documentLabels.mergeIn(folderPath)}
        </Text>
      </div>
      {merge.error ? (
        <Text variant="meta" tone="destructive" role="alert">
          {merge.error.message}
        </Text>
      ) : null}
    </FormDialog>
  )
}
