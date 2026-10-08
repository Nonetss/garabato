/** The part of a folder the tree helpers look at. */
export type FolderNode = { id: string; parentId: string | null; name: string }

export type FolderIndex<TFolder extends FolderNode> = {
  byId: Map<string, TFolder>
  /** Children by parent id (`null` for top-level folders), sorted by name. */
  children: Map<string | null, TFolder[]>
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true })

/** Indexes a flat folder list once, for the lookups below. */
export function buildFolderIndex<TFolder extends FolderNode>(
  folders: TFolder[]
): FolderIndex<TFolder> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const children = new Map<string | null, TFolder[]>()
  for (const folder of folders) {
    const siblings = children.get(folder.parentId) ?? []
    siblings.push(folder)
    children.set(folder.parentId, siblings)
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => collator.compare(a.name, b.name))
  }
  return { byId, children }
}

/** The folders directly inside `parentId` (`null` for the root). */
export function childrenOf<TFolder extends FolderNode>(
  index: FolderIndex<TFolder>,
  parentId: string | null
) {
  return index.children.get(parentId) ?? []
}

/**
 * The folders from the top level down to `id`, `id` last; empty for the root
 * (`null`) or an unknown id. Stops on a loop instead of spinning.
 */
export function pathOf<TFolder extends FolderNode>(
  index: FolderIndex<TFolder>,
  id: string | null
) {
  const path: TFolder[] = []
  let current = id === null ? undefined : index.byId.get(id)
  while (current && !path.includes(current)) {
    path.unshift(current)
    if (current.parentId === null) break
    current = index.byId.get(current.parentId)
  }
  return path
}

/** The ids of every folder below `id`, not including `id` itself. */
export function descendantIdsOf<TFolder extends FolderNode>(
  index: FolderIndex<TFolder>,
  id: string
) {
  const ids = new Set<string>()
  const pending = [...childrenOf(index, id)]
  for (let folder = pending.pop(); folder; folder = pending.pop()) {
    if (ids.has(folder.id)) continue
    ids.add(folder.id)
    pending.push(...childrenOf(index, folder.id))
  }
  return ids
}

/** Every folder in tree order (parents before children, siblings by name),
 *  with its depth: 0 for top-level folders. */
export function flattenTree<TFolder extends FolderNode>(
  index: FolderIndex<TFolder>
) {
  const rows: { folder: TFolder; depth: number }[] = []
  const visit = (parentId: string | null, depth: number) => {
    for (const folder of childrenOf(index, parentId)) {
      rows.push({ folder, depth })
      visit(folder.id, depth + 1)
    }
  }
  visit(null, 0)
  return rows
}

/** "Clientes / Contratos": a folder's path as text; "" for the root. */
export function folderPathLabel<TFolder extends FolderNode>(
  index: FolderIndex<TFolder>,
  id: string | null
) {
  return pathOf(index, id)
    .map((folder) => folder.name)
    .join(" / ")
}
