import type { LucideIconNode } from "lucide-react"

import type { IconCategoryId } from "@/features/entity-icons/picker/model/icon-categories.generated"

export type CatalogIcon = {
  name: string
  categories: IconCategoryId[]
  tags: string[]
  node: LucideIconNode[]
}

export type IconCatalog = {
  version: string
  categories: { id: IconCategoryId; title: string }[]
  icons: CatalogIcon[]
}

/** The generator drops React keys to keep the file small; restore them. */
function withKeys(nodes: LucideIconNode[]): LucideIconNode[] {
  return nodes.map(([tag, attrs], index) => [
    tag,
    { ...attrs, key: `${index}` },
  ])
}

export function prepareIconCatalog(raw: IconCatalog): IconCatalog {
  return {
    ...raw,
    icons: raw.icons.map((icon) => ({ ...icon, node: withKeys(icon.node) })),
  }
}
