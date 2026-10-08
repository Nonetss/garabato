import { sql } from "drizzle-orm"
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "#schema/auth"

export const collectionKinds = ["favorites", "custom"] as const

export type CollectionKind = (typeof collectionKinds)[number]

/** Display snapshot supplied by the resource when it is saved. */
export type CollectionItemMetadata = {
  title?: string
  description?: string
  href?: string
  image?: string
  [key: string]: unknown
}

/**
 * A user-owned list of resources. "favorites" is the built-in list; custom
 * collections are named lists that can be added without changing the model.
 */
export const collection = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<CollectionKind>().notNull(),
    name: text("name"),
    // Optional user-written summary shown on the collection page.
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("collection_owner_id_idx").on(table.ownerId),
    // A user gets at most one built-in favorites collection. Custom
    // collections remain unrestricted.
    uniqueIndex("collection_owner_favorites_idx")
      .on(table.ownerId)
      .where(sql`${table.kind} = 'favorites'`),
  ]
)

/**
 * A polymorphic reference. PostgreSQL cannot express a foreign key whose
 * target table depends on entityType, so valid resource types and cleanup on
 * target deletion are enforced by the application layer.
 */
export const collectionItem = pgTable(
  "collection_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    // Text deliberately accommodates UUID-backed domain records and
    // Better Auth records, whose ids are strings.
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<CollectionItemMetadata | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("collection_item_unique_entity_idx").on(
      table.collectionId,
      table.entityType,
      table.entityId
    ),
    index("collection_item_collection_created_idx").on(
      table.collectionId,
      table.createdAt
    ),
    index("collection_item_entity_idx").on(table.entityType, table.entityId),
  ]
)

export type Collection = typeof collection.$inferSelect
export type NewCollection = typeof collection.$inferInsert
export type CollectionItem = typeof collectionItem.$inferSelect
export type NewCollectionItem = typeof collectionItem.$inferInsert
