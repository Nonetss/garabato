import {
  type AnyPgColumn,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "#schema/auth"

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    content: text("content").notNull(),

    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),

    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    deletedAt: timestamp("deleted_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("comments_entityType_entityId_idx").on(
      table.entityType,
      table.entityId
    ),
    index("comments_parentId_idx").on(table.parentId),
    index("comments_authorId_idx").on(table.authorId),
    index("comments_deletedAt_idx").on(table.deletedAt),
  ]
)

export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
