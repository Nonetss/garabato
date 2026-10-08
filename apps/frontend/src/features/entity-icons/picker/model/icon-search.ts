import type { CatalogIcon } from "@/features/entity-icons/picker/model/icon-catalog"
import type { IconCategoryId } from "@/features/entity-icons/picker/model/icon-categories.generated"

export type IconFilter = {
  /** Categories a screen offers; `null` offers every category. */
  allowed: ReadonlySet<IconCategoryId> | null
  /** Category chosen in the picker's bar; `null` means all offered ones. */
  active: IconCategoryId | null
  term: string
}

function matchesTerm(icon: CatalogIcon, term: string) {
  if (!term) return true
  if (icon.name.includes(term.replaceAll(" ", "-"))) return true
  return icon.tags.some((tag) => tag.includes(term))
}

export function filterIcons(icons: CatalogIcon[], filter: IconFilter) {
  const term = filter.term.trim().toLowerCase()
  const { allowed, active } = filter
  return icons.filter((icon) => {
    if (active && !icon.categories.includes(active)) return false
    if (allowed && !icon.categories.some((id) => allowed.has(id))) return false
    return matchesTerm(icon, term)
  })
}
