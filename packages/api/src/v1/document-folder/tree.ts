import { sameLabel } from "#shared/labels"

/** The part of a folder row the tree rules look at. */
export type FolderNode = { id: string; parentId: string | null; name: string }

/** Top-level folders are level 1; no folder may sit deeper than this. */
export const MAX_FOLDER_DEPTH = 10

function byId(folders: FolderNode[]) {
  return new Map(folders.map((folder) => [folder.id, folder]))
}

/**
 * The folder ids from `id` up to its top-level ancestor, `id` first. Stops
 * at a parent that is missing or already seen, so a corrupt tree can't loop.
 */
function ancestry(folders: FolderNode[], id: string) {
  const index = byId(folders)
  const path: string[] = []
  let current = index.get(id)
  while (current && !path.includes(current.id)) {
    path.push(current.id)
    if (current.parentId === null) break
    current = index.get(current.parentId)
  }
  return path
}

/** Level of a folder (1 for top-level); 0 for the library root (`null`). */
export function depthOf(folders: FolderNode[], id: string | null) {
  if (id === null) return 0
  return ancestry(folders, id).length
}

/** Levels the folder spans with its descendants: 1 for a folder with none. */
export function subtreeHeight(folders: FolderNode[], id: string): number {
  const children = folders.filter((folder) => folder.parentId === id)
  let height = 0
  for (const child of children) {
    height = Math.max(height, subtreeHeight(folders, child.id))
  }
  return height + 1
}

/** Whether `candidateId` is `folderId` itself or lies somewhere below it. */
export function isSelfOrDescendant(
  folders: FolderNode[],
  candidateId: string,
  folderId: string
) {
  return ancestry(folders, candidateId).includes(folderId)
}

/** The folders directly inside `parentId` (`null` for the root). */
export function childrenOf(folders: FolderNode[], parentId: string | null) {
  return folders.filter((folder) => folder.parentId === parentId)
}

/**
 * `name` when no name in `taken` matches it ignoring case; otherwise the
 * first of `name (2)`, `name (3)`… that is free.
 */
export function freeName(taken: string[], name: string) {
  const isTaken = (candidate: string) =>
    taken.some((existing) => sameLabel(existing, candidate))
  if (!isTaken(name)) return name
  let suffix = 2
  while (isTaken(`${name} (${suffix})`)) suffix += 1
  return `${name} (${suffix})`
}
