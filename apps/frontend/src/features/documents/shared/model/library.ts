import { getAppSurface } from "@/lib/app-surfaces"

/** The entity type folders are registered under for entity icons. */
export const DOCUMENT_FOLDER_ENTITY_TYPE = "documentFolder"

/** The query parameter holding the open folder on the documents page. */
export const FOLDER_PARAM = "carpeta"

/** `/documents` for the root, `/documents?carpeta=<id>` for a folder. */
export function folderHref(folderId: string | null) {
  const path = getAppSurface("documents").path
  if (folderId === null) return path
  return `${path}?${FOLDER_PARAM}=${encodeURIComponent(folderId)}`
}

export function folderIconRef(folderId: string) {
  return { entityType: DOCUMENT_FOLDER_ENTITY_TYPE, entityId: folderId }
}
