import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import {
  type DocumentSummary,
  documentLabels,
} from "@/features/documents/shared"
import { formatDateTime, formatFileSize } from "@/lib/format"
import { iconRef } from "@/lib/icon-registry"

function pagesLabel(count: number) {
  if (count === 1) return "1 página"
  return `${count} páginas`
}

/** "3 páginas · 412 KB": the facts under a library card's name. */
export function documentFacts(document: DocumentSummary) {
  return `${pagesLabel(document.pageCount)} · ${formatFileSize(document.sizeBytes)}`
}

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
  getSecondary: (document) => pagesLabel(document.pageCount),
  getOpenHref: (document) => `/documents/${document.id}`,
  getStatus: (document) => {
    if (document.signatureCount === 0) {
      return { tone: "border", label: documentLabels.unsigned }
    }
    return { tone: "foreground", label: documentLabels.signed }
  },
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
