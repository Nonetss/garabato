import type { Context } from "#context"
import {
  DOCUMENT_FOLDER_ENTITY_TYPE,
  documentFolderIconTarget,
} from "#v1/document-folder/icon-target"

type AccessArgs = { context: Context; entityIds: string[] }

/**
 * Decides which entities of one type the caller may see or restyle. Each
 * method returns the subset of `entityIds` the caller is allowed to touch.
 */
export type EntityIconTarget = {
  readable: (args: AccessArgs) => Promise<Set<string>>
  writable: (args: AccessArgs) => Promise<Set<string>>
}

/**
 * Entity types that accept icons. Enabling icons for a new entity type is a
 * new entry here; the table, procedures and frontend components stay as-is.
 */
export const entityIconTargets: Record<string, EntityIconTarget> = {
  [DOCUMENT_FOLDER_ENTITY_TYPE]: documentFolderIconTarget,
}
