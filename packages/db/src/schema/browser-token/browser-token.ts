import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { user } from "#schema/auth"

/** The id of the only settings row. */
export const BROWSER_TOKEN_SETTINGS_ID = "default"

// The browser token's emergency switches, set by administrators from the web.
// One row at most (id 'default'); a missing row means everything enabled
// with no minimum module version.
export const browserTokenSettings = pgTable("browser_token_settings", {
  id: text("id").primaryKey(),
  tokenEnabled: boolean("token_enabled").notNull().default(true),
  installsEnabled: boolean("installs_enabled").notNull().default(true),
  // Modules older than this (major.minor.patch) are refused; null for none.
  minModuleVersion: text("min_module_version"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
})

export type BrowserTokenSettings = typeof browserTokenSettings.$inferSelect
