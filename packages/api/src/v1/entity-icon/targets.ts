import type { Context } from "#context"

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
 * While it is empty, every entityIcon procedure fails with BAD_REQUEST.
 */
export const entityIconTargets: Record<string, EntityIconTarget> = {}
