import { getIcon } from "@/lib/icon-registry"

const DocumentIcon = getIcon("navigation", "documents")
const UploadIcon = getIcon("actions", "upload")
const NewFolderIcon = getIcon("actions", "newFolder")
const TagsIcon = getIcon("actions", "tags")
const FolderIcon = getIcon("entities", "folder")

import { useMemo, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { StateCard } from "@/components/shared/feedback/state-card"
import { IconButton } from "@/components/shared/form/icon-button"
import {
  SegmentedPicker,
  type SegmentedPickerOption,
} from "@/components/shared/form/segmented-picker"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { EntityList } from "@/components/shared/resource/entity-list"
import { FilterChips } from "@/components/shared/resource/filter-chips"
import {
  chipsFor,
  type ResourceFilterDescriptor,
  ResourceFilters,
} from "@/components/shared/resource/resource-filters"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DocumentGrid } from "@/features/documents/overview/components/document-grid"
import {
  FolderDialog,
  type FolderDialogMode,
} from "@/features/documents/overview/components/folder-dialog"
import { FolderGrid } from "@/features/documents/overview/components/folder-grid"
import { ManageTagsDialog } from "@/features/documents/overview/components/manage-tags-dialog"
import { MergeDocumentsDialog } from "@/features/documents/overview/components/merge-documents-dialog"
import { RenameDocumentDialog } from "@/features/documents/overview/components/rename-document-dialog"
import { SelectionBar } from "@/features/documents/overview/components/selection-bar"
import { UploadDocumentDialog } from "@/features/documents/overview/components/upload-document-dialog"
import {
  type DocumentsRowContext,
  documentDefinition,
} from "@/features/documents/overview/definitions/document.definition"
import {
  type FoldersRowContext,
  folderDefinition,
} from "@/features/documents/overview/definitions/folder.definition"
import { useDocumentSelection } from "@/features/documents/overview/hooks/use-document-selection"
import { useLibraryDrag } from "@/features/documents/overview/hooks/use-library-drag"
import { useLibraryView } from "@/features/documents/overview/hooks/use-library-view"
import {
  type FacetDimension,
  facetCounts,
  filterDocuments,
  type LibraryFilters,
  orderDocuments,
  PIN_OPTIONS,
  STATUS_OPTIONS,
} from "@/features/documents/overview/model/library-filters"
import {
  buildFolderIndex,
  childrenOf,
  type DocumentFolder,
  type DocumentSummary,
  DocumentTagsDialog,
  descendantIdsOf,
  documentLabels,
  downloadDocumentVersion,
  FolderPath,
  folderHref,
  folderIconRef,
  folderPathLabel,
  MoveToFolderDialog,
  saveFile,
  useDocumentDelete,
  useDocumentFolderDelete,
  useDocumentFolderMove,
  useDocumentFolders,
  useDocuments,
  useDocumentsDelete,
  useDocumentsMove,
  useDocumentsSetPinned,
  useDocumentTags,
} from "@/features/documents/shared"
import { useEntityIcons } from "@/features/entity-icons"
import { type QueryParamCodec, useQueryParam } from "@/hooks/use-query-param"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { useTargetDialog } from "@/hooks/use-target-dialog"
import { navigate } from "@/lib/navigate"
import { notifyError } from "@/lib/toast"

type DocumentsView = "grid" | "list"

const viewOptions: readonly SegmentedPickerOption<DocumentsView>[] = [
  { value: "grid", label: "Miniaturas" },
  { value: "list", label: "Lista" },
]

// `?vista=lista` keeps the list across reloads; the thumbnails are the default.
const viewCodec: QueryParamCodec<DocumentsView> = {
  parse: (raw) => {
    if (raw === "lista") return "list"
    return "grid"
  },
  serialize: (value) => {
    if (value === "list") return "lista"
    return "miniaturas"
  },
}

const SELECT_ALL_ID = "documents-select-all"

const FILTER_KEYS = {
  query: "documents-filter-name",
  tags: "documents-filter-tags",
  status: "documents-filter-status",
  pin: "documents-filter-pin",
} as const

const statusLabels: Record<(typeof STATUS_OPTIONS)[number], string> = {
  signed: documentLabels.signed,
  unsigned: documentLabels.unsigned,
}

const pinLabels: Record<(typeof PIN_OPTIONS)[number], string> = {
  pinned: documentLabels.pinned,
  unpinned: documentLabels.notPinned,
}

/** What "Mover a…" is moving. */
type MoveTarget =
  | { kind: "documents"; documents: DocumentSummary[] }
  | { kind: "folder"; folder: DocumentFolder }

/** The library filters a (possibly draft) set of descriptors stands for. */
function filtersFrom(
  descriptors: ResourceFilterDescriptor[],
  current: LibraryFilters
): LibraryFilters {
  const next = { ...current }
  for (const descriptor of descriptors) {
    if (descriptor.kind !== "facet") continue
    if (descriptor.key === FILTER_KEYS.tags) next.tags = descriptor.value
    if (descriptor.key === FILTER_KEYS.status) next.status = descriptor.value
    if (descriptor.key === FILTER_KEYS.pin) next.pin = descriptor.value
  }
  return next
}

function moveTitleOf(target: MoveTarget | null) {
  if (!target) return documentLabels.moveSubmit
  if (target.kind === "folder") {
    return documentLabels.moveFolderTitle(target.folder.name)
  }
  return documentLabels.moveTitle(target.documents.length)
}

function download(document: DocumentSummary) {
  downloadDocumentVersion(document.id)
    .then(saveFile)
    .catch((error: Error) =>
      notifyError("No se pudo descargar el documento", error.message)
    )
}

export function DocumentsContent() {
  const documentsQuery = useDocuments()
  const { data: documents = [] } = documentsQuery
  const { data: folders = [], isPending: foldersPending } = useDocumentFolders()
  const { data: tags = [] } = useDocumentTags()
  const { folderId, filters, setFilters, clearFilters, filtering } =
    useLibraryView()
  const [view, setView] = useQueryParam<DocumentsView>(
    "vista",
    "grid",
    viewCodec
  )

  const index = useMemo(() => buildFolderIndex(folders), [folders])
  const tagsById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags]
  )
  const folderMissing =
    folderId !== null && !foldersPending && !index.byId.has(folderId)

  const subfolders = filtering ? [] : childrenOf(index, folderId)
  const inView = filtering
    ? filterDocuments(documents, filters)
    : documents.filter((document) => document.folderId === folderId)
  const listed = orderDocuments(inView)
  const selection = useDocumentSelection(
    listed.map((document) => document.id),
    `${folderId}|${JSON.stringify(filters)}`
  )
  const selectedDocuments = listed.filter((document) =>
    selection.isSelected(document.id)
  )
  const { iconFor } = useEntityIcons(
    subfolders.map((folder) => folderIconRef(folder.id))
  )

  const moveDocuments = useDocumentsMove()
  const setPinned = useDocumentsSetPinned()
  const deleteDocuments = useDocumentsDelete()
  const deleteDocument = useDocumentDelete()
  const moveFolder = useDocumentFolderMove()
  const deleteFolder = useDocumentFolderDelete()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  const [deleteManyOpen, setDeleteManyOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  // Filtered results span the library, so a merge then lands in the root.
  const mergeFolderId = filtering ? null : folderId
  const folderDialog = useTargetDialog<FolderDialogMode>()
  const renameDialog = useTargetDialog<DocumentSummary>()
  const moveDialog = useTargetDialog<MoveTarget>()
  const tagsDialog = useTargetDialog<DocumentSummary[]>()
  const deleteDialog = useTargetConfirmDialog<DocumentSummary>({
    title: documentLabels.deleteTitle,
    description: (document) => documentLabels.deleteDescription(document.name),
    confirmLabel: documentLabels.delete,
    onConfirm: (document) => deleteDocument.mutateAsync({ id: document.id }),
  })
  const deleteFolderDialog = useTargetConfirmDialog<DocumentFolder>({
    title: documentLabels.deleteFolderTitle,
    description: (folder) =>
      documentLabels.deleteFolderDescription(folder.name),
    confirmLabel: documentLabels.delete,
    onConfirm: (folder) => deleteFolder.mutateAsync({ id: folder.id }),
  })

  const drag = useLibraryDrag({
    index,
    documents,
    selectedIds: selection.ids,
    onMoveDocuments: (ids, target) =>
      moveDocuments.mutate({ ids, folderId: target }),
    onMoveFolder: (id, parentId) => moveFolder.mutate({ id, parentId }),
  })

  const rowContext: DocumentsRowContext = {
    tags: tagsById,
    folderIndex: index,
    showFolder: filtering,
    dragSource: drag.documentSource,
    onDownload: download,
    onRename: renameDialog.open,
    onMove: (document) =>
      moveDialog.open({ kind: "documents", documents: [document] }),
    onTags: (document) => tagsDialog.open([document]),
    onTogglePin: (document) =>
      setPinned.mutate({
        ids: [document.id],
        pinned: document.pinnedAt === null,
      }),
    onDelete: deleteDialog.open,
  }

  const folderContext: FoldersRowContext = {
    iconFor: (folder) => iconFor(folderIconRef(folder.id)),
    dragSource: drag.folderSource,
    dropTarget: drag.dropTarget,
    onEdit: (folder) => folderDialog.open({ kind: "rename", folder }),
    onMove: (folder) => moveDialog.open({ kind: "folder", folder }),
    onDelete: deleteFolderDialog.open,
  }

  const moveTarget = moveDialog.target
  const isMoveDisabled = (target: string | null) => {
    if (!moveTarget) return true
    if (moveTarget.kind === "documents") {
      return moveTarget.documents.every(
        (document) => document.folderId === target
      )
    }
    const { folder } = moveTarget
    if (target === folder.parentId) return true
    if (target === null) return false
    return target === folder.id || descendantIdsOf(index, folder.id).has(target)
  }
  const handleMove = async (target: string | null) => {
    if (!moveTarget) return
    if (moveTarget.kind === "folder") {
      await moveFolder.mutateAsync({
        id: moveTarget.folder.id,
        parentId: target,
      })
      return
    }
    await moveDocuments.mutateAsync({
      ids: moveTarget.documents.map((document) => document.id),
      folderId: target,
    })
    selection.clear()
  }

  const facet = (
    dimension: FacetDimension,
    options: readonly string[],
    label: (option: string) => string
  ) => {
    const counts = facetCounts(documents, filters, dimension, options)
    return options.map((option) => ({
      value: option,
      label: label(option),
      count: counts.get(option),
    }))
  }

  const filterDescriptors: ResourceFilterDescriptor[] = [
    {
      kind: "search",
      key: FILTER_KEYS.query,
      label: documentLabels.searchName,
      value: filters.query,
      onChange: (query) => setFilters((current) => ({ ...current, query })),
      placeholder: documentLabels.searchPlaceholder,
    },
    {
      kind: "facet",
      key: FILTER_KEYS.status,
      label: documentLabels.status,
      options: facet("status", STATUS_OPTIONS, (option) => {
        if (option === "signed") return statusLabels.signed
        return statusLabels.unsigned
      }),
      value: filters.status,
      onChange: (status) => setFilters((current) => ({ ...current, status })),
      excludable: false,
    },
    {
      kind: "facet",
      key: FILTER_KEYS.pin,
      label: documentLabels.pinState,
      options: facet("pin", PIN_OPTIONS, (option) => {
        if (option === "pinned") return pinLabels.pinned
        return pinLabels.unpinned
      }),
      value: filters.pin,
      onChange: (pin) => setFilters((current) => ({ ...current, pin })),
      excludable: false,
    },
  ]
  if (tags.length > 0) {
    filterDescriptors.splice(1, 0, {
      kind: "facet",
      key: FILTER_KEYS.tags,
      label: documentLabels.tags,
      options: facet(
        "tags",
        tags.map((tag) => tag.id),
        (tagId) => tagsById.get(tagId)?.name ?? ""
      ),
      value: filters.tags,
      onChange: (value) =>
        setFilters((current) => ({ ...current, tags: value })),
    })
  }

  const signedCount = documents.filter(
    (document) => document.signatureCount > 0
  ).length

  const uploadButton = (
    <Button onClick={() => setUploadOpen(true)}>
      <UploadIcon className="size-4" />
      {documentLabels.upload}
    </Button>
  )
  const openNewFolder = () =>
    folderDialog.open({ kind: "create", parentId: folderId })
  const newFolderButton = (
    <Button variant="outline" onClick={openNewFolder}>
      <NewFolderIcon className="size-4" />
      {documentLabels.newFolder}
    </Button>
  )
  const libraryEmpty = documents.length === 0 && folders.length === 0

  const renderContent = () => {
    if (folderMissing) {
      return (
        <StateCard
          icon={<FolderIcon className="size-6" />}
          title={documentLabels.folderNotFound}
          description={documentLabels.folderNotFoundDescription}
          action={
            <Button
              variant="outline"
              render={<AppLink href={folderHref(null)} />}
              nativeButton={false}
            >
              {documentLabels.backToRoot}
            </Button>
          }
        />
      )
    }
    if (filtering && listed.length === 0) {
      return (
        <StateCard
          icon={<DocumentIcon className="size-6" />}
          title={documentLabels.noMatches}
          description={documentLabels.noMatchesDescription}
          action={
            <Button variant="outline" onClick={clearFilters}>
              {documentLabels.clearFilters}
            </Button>
          }
        />
      )
    }
    if (!filtering && subfolders.length === 0 && listed.length === 0) {
      return (
        <StateCard
          icon={<FolderIcon className="size-6" />}
          title={documentLabels.emptyFolder}
          description={documentLabels.emptyFolderDescription}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {uploadButton}
              {newFolderButton}
            </div>
          }
        />
      )
    }

    const documentSelection = {
      active: selection.count > 0,
      isSelected: (document: DocumentSummary) =>
        selection.isSelected(document.id),
      onToggle: (document: DocumentSummary) => selection.toggle(document.id),
    }
    if (view === "list") {
      return (
        <div className="space-y-6">
          {subfolders.length > 0 ? (
            <EntityList
              items={subfolders}
              context={folderContext}
              definition={folderDefinition}
            />
          ) : null}
          {listed.length > 0 ? (
            <EntityList
              items={listed}
              context={rowContext}
              definition={documentDefinition}
              selection={{
                ...documentSelection,
                getLabel: (document) => documentLabels.select(document.name),
              }}
            />
          ) : null}
        </div>
      )
    }
    return (
      <div className="space-y-8">
        <FolderGrid folders={subfolders} context={folderContext} />
        {listed.length > 0 ? (
          <DocumentGrid
            documents={listed}
            context={rowContext}
            selection={documentSelection}
          />
        ) : null}
      </div>
    )
  }

  return (
    <>
      <ResourceOverview
        surface="documents"
        heroAction={
          <div className="flex flex-wrap gap-2">
            <IconButton
              label={documentLabels.manageTags}
              icon={TagsIcon}
              variant="outline"
              size="icon"
              onClick={() => setManageTagsOpen(true)}
            />
            <IconButton
              label={documentLabels.newFolder}
              icon={NewFolderIcon}
              variant="outline"
              size="icon"
              onClick={openNewFolder}
            />
            {uploadButton}
          </div>
        }
        heroChildren={
          // The library's ledger line: what is on the desk and how it is
          // laid out, ruled off from the sheets below.
          libraryEmpty ? null : (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b pb-4">
              <HeroCount
                segments={[
                  { count: signedCount, label: "firmados" },
                  { count: documents.length, label: "total" },
                ]}
              />
              <div className="w-44">
                <SegmentedPicker
                  label="Vista"
                  options={viewOptions}
                  value={view}
                  onChange={setView}
                  columns={2}
                />
              </div>
            </div>
          )
        }
        filters={
          libraryEmpty ? null : (
            <div className="space-y-3">
              <ResourceFilters
                columns={3}
                filters={filterDescriptors}
                onClear={clearFilters}
                hideMobileActionBar={selection.count > 0}
                fetchDraftTotal={(draft) =>
                  filterDocuments(documents, filtersFrom(draft, filters)).length
                }
              />
              <FilterChips
                chips={chipsFor(filterDescriptors)}
                onClear={clearFilters}
              />
              <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
                {filtering ? (
                  <Text as="p" variant="meta" tone="muted" aria-live="polite">
                    {documentLabels.libraryResults(listed.length)}
                  </Text>
                ) : (
                  <FolderPath
                    index={index}
                    folderId={folderId}
                    currentIsLink={false}
                    getDropTarget={drag.dropTarget}
                  />
                )}
                {listed.length > 0 && !folderMissing ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={SELECT_ALL_ID}
                      checked={selection.allSelected}
                      indeterminate={
                        selection.count > 0 && !selection.allSelected
                      }
                      onCheckedChange={selection.toggleAll}
                    />
                    <label htmlFor={SELECT_ALL_ID}>
                      <Text variant="compact" tone="muted">
                        {documentLabels.selectAll}
                      </Text>
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          )
        }
        query={{ ...documentsQuery, data: documents }}
        loading="Cargando documentos…"
        error={{
          icon: <DocumentIcon className="size-6" />,
          title: "No se pudieron cargar los documentos",
          description:
            "Comprueba tu conexión; si el problema continúa, inténtalo de nuevo más tarde.",
        }}
        isEmpty={() => libraryEmpty}
        empty={{
          icon: <DocumentIcon className="size-6" />,
          title: "Todavía no tienes documentos",
          description: "Sube un PDF para firmarlo con uno de tus certificados.",
          action: (
            <div className="flex flex-wrap justify-center gap-2">
              {uploadButton}
              {newFolderButton}
            </div>
          ),
        }}
      >
        {renderContent}
      </ResourceOverview>

      <SelectionBar
        count={selection.count}
        onMove={() =>
          moveDialog.open({ kind: "documents", documents: selectedDocuments })
        }
        onTags={() => tagsDialog.open(selectedDocuments)}
        onPin={() => setPinned.mutate({ ids: selection.ids, pinned: true })}
        onUnpin={() => setPinned.mutate({ ids: selection.ids, pinned: false })}
        onMerge={() => setMergeOpen(true)}
        onDelete={() => setDeleteManyOpen(true)}
        onClear={selection.clear}
      />

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        folderId={folderId}
      />
      <FolderDialog mode={folderDialog.target} {...folderDialog.dialogProps} />
      <RenameDocumentDialog
        document={renameDialog.target}
        {...renameDialog.dialogProps}
      />
      <MoveToFolderDialog
        {...moveDialog.dialogProps}
        title={moveTitleOf(moveTarget)}
        isDisabled={isMoveDisabled}
        onMove={handleMove}
        isPending={moveDocuments.isPending || moveFolder.isPending}
      />
      <DocumentTagsDialog
        {...tagsDialog.dialogProps}
        documents={tagsDialog.target ?? []}
      />
      <ManageTagsDialog
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
      />
      <MergeDocumentsDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        documents={selectedDocuments}
        folderId={mergeFolderId}
        folderPath={folderPathLabel(index, mergeFolderId)}
        onMerged={(document) => {
          selection.clear()
          navigate(`/documents/${document.id}`)
        }}
      />
      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
      <ConfirmDialog {...deleteFolderDialog.confirmDialogProps} />
      <ConfirmDialog
        open={deleteManyOpen}
        onOpenChange={setDeleteManyOpen}
        title={documentLabels.deleteManyTitle(selection.count)}
        description={documentLabels.deleteManyDescription(selection.count)}
        confirmLabel={documentLabels.delete}
        variant="destructive"
        onConfirm={async () => {
          await deleteDocuments.mutateAsync({ ids: selection.ids })
          selection.clear()
          return true
        }}
      />
    </>
  )
}
