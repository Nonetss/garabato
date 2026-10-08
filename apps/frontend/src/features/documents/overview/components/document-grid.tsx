import { Fragment } from "react"
import { Text } from "@/components/shared/brand/typography"
import { RowActionsMenu } from "@/components/shared/data-display/row-actions-menu"
import { StatusTag } from "@/components/shared/data-display/status-dot"
import type { EntityListActionDescriptor } from "@/components/shared/resource/entity-list"
import { AppLink } from "@/components/ui/app-link"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { DocumentThumbnail } from "@/features/documents/overview/components/document-thumbnail"
import {
  DocumentName,
  type DocumentsRowContext,
  documentDefinition,
  documentLocation,
} from "@/features/documents/overview/definitions/document.definition"
import {
  type DocumentSummary,
  documentFacts,
  documentLabels,
  TagChips,
} from "@/features/documents/shared"
import { resolveIconRef } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

/** The card's selection, mirroring `EntityList`'s `selection`. */
export interface DocumentGridSelection {
  active: boolean
  isSelected: (document: DocumentSummary) => boolean
  onToggle: (document: DocumentSummary) => void
}

type Action = EntityListActionDescriptor<DocumentSummary, DocumentsRowContext>

function actionLabel(
  action: Action,
  document: DocumentSummary,
  context: DocumentsRowContext
) {
  if (typeof action.label === "function") return action.label(document, context)
  return action.label
}

function ActionIcon({
  action,
  document,
  context,
}: {
  action: Action
  document: DocumentSummary
  context: DocumentsRowContext
}) {
  const ref =
    typeof action.icon === "function"
      ? action.icon(document, context)
      : action.icon
  if (!ref) return null
  const Icon = resolveIconRef(ref)
  return <Icon className="size-4" />
}

function DocumentCard({
  document,
  context,
  selection,
}: {
  document: DocumentSummary
  context: DocumentsRowContext
  selection: DocumentGridSelection
}) {
  const href = `/documents/${document.id}`
  const status = documentDefinition.getStatus?.(document, context)
  const selected = selection.isSelected(document)
  const actions = documentDefinition.actions ?? []

  return (
    <li
      {...context.dragSource(document)}
      className="group relative flex min-w-0 flex-col gap-3"
    >
      {/* The sheet repeats the title link for the pointer; keyboard and
          screen readers use the named link below. */}
      <AppLink
        href={href}
        tabIndex={-1}
        aria-hidden
        className={cn(
          "block rounded-md bg-desk p-4 transition-colors group-hover:bg-muted @md:p-5",
          selected && "ring-2 ring-ring/60"
        )}
      >
        <DocumentThumbnail
          documentId={document.id}
          signed={document.signatureCount > 0}
          className="transition-transform duration-300 ease-out group-hover:-translate-y-1"
        />
      </AppLink>
      {/* Shown on hover and focus, and always once something is selected. */}
      <Checkbox
        checked={selected}
        onCheckedChange={() => selection.onToggle(document)}
        aria-label={documentLabels.select(document.name)}
        className={cn(
          "absolute top-2.5 left-2.5 size-5 bg-background transition-opacity",
          !(selected || selection.active) &&
            "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
        )}
      />

      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Text as="h3" variant="title" className="truncate">
            <AppLink
              href={href}
              className="outline-none hover:underline focus-visible:underline"
            >
              <DocumentName document={document} />
            </AppLink>
          </Text>
          <Text as="p" variant="compact" tone="muted" className="tabular-nums">
            {documentFacts(document)}
          </Text>
          {context.showFolder ? (
            <Text as="p" variant="compact" tone="muted" className="truncate">
              {documentLocation(document, context)}
            </Text>
          ) : null}
          {status ? (
            <StatusTag dotTone={status.tone}>{status.label}</StatusTag>
          ) : null}
          <TagChips tagIds={document.tagIds} tags={context.tags} />
        </div>
        <RowActionsMenu label={`Acciones de ${document.name}`}>
          {actions.map((action) => (
            <Fragment key={action.key}>
              {action.destructive ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant={action.destructive ? "destructive" : undefined}
                onClick={() => action.onSelect(document, context)}
              >
                <ActionIcon
                  action={action}
                  document={document}
                  context={context}
                />
                {actionLabel(action, document, context)}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </RowActionsMenu>
      </div>
    </li>
  )
}

/** The library as sheets: each document's first page, name and state. */
export function DocumentGrid({
  documents,
  context,
  selection,
}: {
  documents: DocumentSummary[]
  context: DocumentsRowContext
  selection: DocumentGridSelection
}) {
  return (
    <div className="@container">
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-5">
        {documents.map((document) => (
          <DocumentCard
            key={document.id}
            document={document}
            context={context}
            selection={selection}
          />
        ))}
      </ul>
    </div>
  )
}
