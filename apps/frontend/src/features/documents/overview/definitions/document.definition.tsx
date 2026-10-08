import { getIcon } from "@/lib/icon-registry"

const PinIcon = getIcon("actions", "pin")

import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import type { DragSourceProps } from "@/features/documents/overview/hooks/use-library-drag"
import {
  type DocumentFolder,
  type DocumentSummary,
  type DocumentTag,
  documentLabels,
  documentSigningStatus,
  type FolderIndex,
  folderPathLabel,
  formatPageCount,
  TagChips,
} from "@/features/documents/shared"
import { formatDateTime, formatFileSize } from "@/lib/format"
import { iconRef } from "@/lib/icon-registry"

export interface DocumentsRowContext {
  tags: Map<string, DocumentTag>
  folderIndex: FolderIndex<DocumentFolder>
  /** Results span the whole library: show where each document lives. */
  showFolder: boolean
  dragSource: (document: DocumentSummary) => DragSourceProps
  onDownload: (document: DocumentSummary) => void
  onRename: (document: DocumentSummary) => void
  onMove: (document: DocumentSummary) => void
  onTags: (document: DocumentSummary) => void
  onTogglePin: (document: DocumentSummary) => void
  onDelete: (document: DocumentSummary) => void
}

/** The folder path of a document, "Documentos" for the root. */
export function documentLocation(
  document: DocumentSummary,
  context: DocumentsRowContext
) {
  const path = folderPathLabel(context.folderIndex, document.folderId)
  if (path === "") return documentLabels.root
  return path
}

/** The name, after a pin when the document is pinned. */
export function DocumentName({ document }: { document: DocumentSummary }) {
  if (document.pinnedAt === null) return document.name
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <PinIcon
        aria-label={documentLabels.pinned}
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <span className="truncate">{document.name}</span>
    </span>
  )
}

/** The documents overview's `EntityList` row: name, signing status, size,
 *  tags and signature metadata, and the document actions. */
export const documentDefinition: EntityListDefinition<
  DocumentSummary,
  DocumentsRowContext
> = {
  getKey: (document) => document.id,
  getAccessibleLabel: (document) => document.name,
  getPrimary: (document) => <DocumentName document={document} />,
  getSecondary: (document, context) => {
    if (context.showFolder) return documentLocation(document, context)
    return formatPageCount(document.pageCount)
  },
  getOpenHref: (document) => `/documents/${document.id}`,
  getStatus: (document) => documentSigningStatus(document),
  getRowDragProps: (document, context) => context.dragSource(document),
  metadata: [
    {
      key: "tags",
      label: documentLabels.tags,
      hidden: (document) => document.tagIds.length === 0,
      value: (document, context) => (
        <TagChips tagIds={document.tagIds} tags={context.tags} max={2} />
      ),
    },
    {
      key: "size",
      label: documentLabels.size,
      value: (document) => (
        <span className="tabular-nums">
          {formatFileSize(document.sizeBytes)}
        </span>
      ),
    },
    {
      key: "signatures",
      label: documentLabels.signatures,
      value: (document) => (
        <span className="tabular-nums">{document.signatureCount}</span>
      ),
    },
    {
      key: "lastSigned",
      label: documentLabels.lastSigned,
      value: (document) => (
        <span className="tabular-nums">
          {formatDateTime(document.lastSignedAt, { includeYear: true })}
        </span>
      ),
    },
  ],
  actions: [
    {
      key: "download",
      label: documentLabels.download,
      icon: iconRef("actions", "download"),
      onSelect: (document, ctx) => ctx.onDownload(document),
    },
    {
      key: "rename",
      label: documentLabels.rename,
      icon: iconRef("actions", "edit"),
      onSelect: (document, ctx) => ctx.onRename(document),
    },
    {
      key: "move",
      label: documentLabels.move,
      icon: iconRef("actions", "move"),
      onSelect: (document, ctx) => ctx.onMove(document),
    },
    {
      key: "tags",
      label: documentLabels.tags,
      icon: iconRef("actions", "tags"),
      onSelect: (document, ctx) => ctx.onTags(document),
    },
    {
      key: "pin",
      label: (document) => {
        if (document.pinnedAt === null) return documentLabels.pin
        return documentLabels.unpin
      },
      icon: (document) => {
        if (document.pinnedAt === null) return iconRef("actions", "pin")
        return iconRef("actions", "unpin")
      },
      onSelect: (document, ctx) => ctx.onTogglePin(document),
    },
    {
      key: "delete",
      label: documentLabels.delete,
      icon: iconRef("actions", "delete"),
      destructive: true,
      onSelect: (document, ctx) => ctx.onDelete(document),
    },
  ],
}
