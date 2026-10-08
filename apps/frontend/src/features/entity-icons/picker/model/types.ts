import type { AppRouterClient } from "@nonete/api/router"

type EntityIconRecord = Awaited<
  ReturnType<AppRouterClient["v1"]["entityIcon"]["set"]>
>

/** Palette key stored with an icon; the theme owns the actual color. */
export type EntityIconColor = EntityIconRecord["color"]

/** What a picker edits: a Lucide icon name plus its palette color. */
export type EntityIconValue = {
  icon: string
  color: EntityIconColor
}

/** Polymorphic reference to the entity an icon belongs to. */
export type EntityIconRef = {
  entityType: string
  entityId: string
}

export function entityIconKey(ref: EntityIconRef) {
  return `${ref.entityType}:${ref.entityId}`
}
