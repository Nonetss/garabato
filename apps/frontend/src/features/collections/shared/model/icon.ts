import type { EntityIconRef, IconCategoryId } from "@/features/entity-icons"

/** Lucide categories offered when choosing a collection's icon. */
export const COLLECTION_ICON_CATEGORIES = [
  "files",
  "text",
  "multimedia",
  "photography",
  "food-beverage",
  "travel",
  "home",
  "finance",
  "shopping",
  "development",
  "science",
  "nature",
  "animals",
  "sports",
  "gaming",
  "emoji",
] as const satisfies readonly IconCategoryId[]

export function collectionIconRef(collectionId: string): EntityIconRef {
  return { entityType: "collection", entityId: collectionId }
}
