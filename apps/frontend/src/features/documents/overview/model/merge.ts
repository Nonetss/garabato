import type {
  DocumentSummary,
  MergeDocumentsInput,
} from "@/features/documents/shared/model/types"

const PDF_EXTENSION = /\.pdf$/i

/** The merged document's suggested name: the first one's, without `.pdf`. */
export function defaultMergeName(documents: Pick<DocumentSummary, "name">[]) {
  const [first] = documents
  if (!first) return ""
  return first.name.replace(PDF_EXTENSION, "")
}

/** The merge request: the documents in `order`, into `folderId` or the root. */
export function mergeRequest(
  order: Pick<DocumentSummary, "id">[],
  name: string,
  folderId: string | null
): MergeDocumentsInput {
  const documentIds = order.map((document) => document.id)
  if (folderId === null) return { documentIds, name }
  return { documentIds, name, folderId }
}
