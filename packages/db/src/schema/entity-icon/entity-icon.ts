import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "#schema/auth"

/** Palette keys an entity icon can be painted with; the theme owns the values. */
export const entityIconColors = [
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "violet",
  "rose",
  "neutral",
] as const

export type EntityIconColor = (typeof entityIconColors)[number]

/**
 * A user-chosen Lucide icon for any entity. Like comments, the target is a
 * polymorphic reference: which entity types accept icons, and who may read or
 * change them, is decided by the application layer, which also removes the
 * row when the target is deleted.
 */
export const entityIcons = pgTable(
  "entity_icons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(),
    // Text so both UUID-backed records and Better Auth string ids fit.
    entityId: text("entity_id").notNull(),
    // Lucide icon name in kebab-case (e.g. "book-open").
    icon: text("icon").notNull(),
    color: text("color").$type<EntityIconColor>().notNull().default("orange"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("entity_icons_entity_idx").on(table.entityType, table.entityId),
  ]
)

export type EntityIcon = typeof entityIcons.$inferSelect
export type NewEntityIcon = typeof entityIcons.$inferInsert
