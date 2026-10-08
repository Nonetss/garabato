import type { AppRouterClient } from "@nonete/api/router"

export type CollectionEntityRef = {
  entityType: string
  entityId: string
  metadata?: CollectionItemMetadata
}

export type CollectionItemMetadata = {
  title?: string
  description?: string
  href?: string
  image?: string
  [key: string]: unknown
}

export type FavoriteEntityRef = CollectionEntityRef

export type FavoriteItem = Awaited<
  ReturnType<AppRouterClient["v1"]["collection"]["listFavorites"]>
>[number]

export type Collection = Awaited<
  ReturnType<AppRouterClient["v1"]["collection"]["list"]>
>[number]

export type CollectionItem = Awaited<
  ReturnType<AppRouterClient["v1"]["collection"]["listItems"]>
>[number]
