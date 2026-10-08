import { getIcon } from "@/lib/icon-registry"

const DownloadIcon = getIcon("actions", "download")
const EditIcon = getIcon("actions", "edit")
const DeleteIcon = getIcon("actions", "delete")

import { Text } from "@/components/shared/brand/typography"
import { RowActionsMenu } from "@/components/shared/data-display/row-actions-menu"
import { StatusTag } from "@/components/shared/data-display/status-dot"
import { AppLink } from "@/components/ui/app-link"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { DocumentThumbnail } from "@/features/documents/overview/components/document-thumbnail"
import {
  type DocumentsRowContext,
  documentDefinition,
} from "@/features/documents/overview/definitions/document.definition"
import {
  type DocumentSummary,
  documentFacts,
  documentLabels,
} from "@/features/documents/shared"

function DocumentCard({
  document,
  context,
}: {
  document: DocumentSummary
  context: DocumentsRowContext
}) {
  const href = `/documents/${document.id}`
  const status = documentDefinition.getStatus?.(document, context)

  return (
    <li className="group flex min-w-0 flex-col gap-3">
      {/* The sheet repeats the title link for the pointer; keyboard and
          screen readers use the named link below. */}
      <AppLink
        href={href}
        tabIndex={-1}
        aria-hidden
        className="block rounded-md bg-desk p-4 transition-colors group-hover:bg-muted @md:p-5"
      >
        <DocumentThumbnail
          documentId={document.id}
          signed={document.signatureCount > 0}
          className="transition-transform duration-300 ease-out group-hover:-translate-y-1"
        />
      </AppLink>

      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Text as="h3" variant="title" className="truncate">
            <AppLink
              href={href}
              className="outline-none hover:underline focus-visible:underline"
            >
              {document.name}
            </AppLink>
          </Text>
          <Text as="p" variant="compact" tone="muted" className="tabular-nums">
            {documentFacts(document)}
          </Text>
          {status ? (
            <StatusTag dotTone={status.tone}>{status.label}</StatusTag>
          ) : null}
        </div>
        <RowActionsMenu label={`Acciones de ${document.name}`}>
          <DropdownMenuItem onClick={() => context.onDownload(document)}>
            <DownloadIcon className="size-4" />
            {documentLabels.download}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => context.onRename(document)}>
            <EditIcon className="size-4" />
            {documentLabels.rename}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => context.onDelete(document)}
          >
            <DeleteIcon className="size-4" />
            {documentLabels.delete}
          </DropdownMenuItem>
        </RowActionsMenu>
      </div>
    </li>
  )
}

/** The library as sheets: each document's first page, name and state. */
export function DocumentGrid({
  documents,
  context,
}: {
  documents: DocumentSummary[]
  context: DocumentsRowContext
}) {
  return (
    <div className="@container">
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-5">
        {documents.map((document) => (
          <DocumentCard
            key={document.id}
            document={document}
            context={context}
          />
        ))}
      </ul>
    </div>
  )
}
