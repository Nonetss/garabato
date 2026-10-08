import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import {
  type DocumentSummary,
  documentLabels,
  documentSigningStatus,
  formatPageCount,
} from "@/features/documents/shared"
import { formatDateTime, formatFileSize } from "@/lib/format"
import { iconRef } from "@/lib/icon-registry"

export interface DocumentsRowContext {
  onDownload: (document: DocumentSummary) => void
  onRename: (document: DocumentSummary) => void
  onDelete: (document: DocumentSummary) => void
}

/** The documents overview's `EntityList` row: name, signing status, size and
 *  signature metadata, and the download/rename/delete actions. */
export const documentDefinition: EntityListDefinition<
  DocumentSummary,
  DocumentsRowContext
> = {
  getKey: (document) => document.id,
  getAccessibleLabel: (document) => document.name,
  getPrimary: (document) => document.name,
  getSecondary: (document) => formatPageCount(document.pageCount),
  getOpenHref: (document) => `/documents/${document.id}`,
  getStatus: (document) => documentSigningStatus(document),
  metadata: [
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
      key: "delete",
      label: documentLabels.delete,
      icon: iconRef("actions", "delete"),
      destructive: true,
      onSelect: (document, ctx) => ctx.onDelete(document),
    },
  ],
}
