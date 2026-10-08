export { DocumentTagsDialog } from "@/features/documents/shared/components/document-tags-dialog"
export {
  type FolderDropTargetProps,
  FolderPath,
} from "@/features/documents/shared/components/folder-path"
export { MoveToFolderDialog } from "@/features/documents/shared/components/move-to-folder-dialog"
export {
  TagChip,
  TagChips,
} from "@/features/documents/shared/components/tag-chips"
export {
  documentFacts,
  documentSigningStatus,
  formatPageCount,
} from "@/features/documents/shared/definitions/document-facts"
export { documentLabels } from "@/features/documents/shared/definitions/document-labels"
export {
  documentFoldersKey,
  useDocumentFolderCreate,
  useDocumentFolderDelete,
  useDocumentFolderMove,
  useDocumentFolderRename,
  useDocumentFolders,
} from "@/features/documents/shared/hooks/use-document-folders"
export {
  documentTagsKey,
  useDocumentTagCreate,
  useDocumentTagDelete,
  useDocumentTags,
  useDocumentTagUpdate,
} from "@/features/documents/shared/hooks/use-document-tags"
export {
  downloadDocumentVersion,
  useDocument,
  useDocumentDelete,
  useDocumentFile,
  useDocumentPreviewFile,
  useDocumentRename,
  useDocumentSign,
  useDocuments,
  useDocumentsDelete,
  useDocumentsMove,
  useDocumentsSetPinned,
  useDocumentsUpdateTags,
  useDocumentUpload,
} from "@/features/documents/shared/hooks/use-documents"
export { usePdfDocument } from "@/features/documents/shared/hooks/use-pdf-document"
export {
  MAX_PDF_BYTES,
  type PdfFileProblem,
  pdfFileProblem,
  saveFile,
} from "@/features/documents/shared/model/files"
export {
  buildFolderIndex,
  childrenOf,
  descendantIdsOf,
  type FolderIndex,
  flattenTree,
  folderPathLabel,
  pathOf,
} from "@/features/documents/shared/model/folder-tree"
export {
  DOCUMENT_FOLDER_ENTITY_TYPE,
  FOLDER_PARAM,
  folderHref,
  folderIconRef,
} from "@/features/documents/shared/model/library"
export type {
  DocumentDetail,
  DocumentFolder,
  DocumentSummary,
  DocumentTag,
  DocumentVersion,
  SignAppearance,
  SignatureRecord,
  SignInput,
  StampRect,
} from "@/features/documents/shared/model/types"
