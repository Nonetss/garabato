import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "#schema/auth"
import { certificates } from "#schema/certificate"
import { documents, documentVersions } from "#schema/document"

/** The actions on certificates, documents, connected browsers and the
 *  account that leave a trace, plus the security-relevant refusals
 *  (`*Failed`, `browser.installRefused`). Signatures are not listed: their
 *  evidence lives in `document_signatures`. */
export const TRACE_TYPES = [
  "certificate.imported",
  "certificate.renamed",
  "certificate.passwordRemembered",
  "certificate.passwordForgotten",
  "certificate.deleted",
  "certificate.usedToSignIn",
  "document.uploaded",
  "document.merged",
  "document.pagesEdited",
  "document.downloaded",
  "document.renamed",
  "document.moved",
  "document.versionDeleted",
  "document.deleted",
  "browser.connected",
  "browser.disconnected",
  "browser.unlocked",
  "browser.unlockFailed",
  "browser.locked",
  "browser.installRefused",
  "account.signedIn",
  "account.signInFailed",
  "account.signedOut",
  "account.nameChanged",
  "account.passwordChanged",
  "account.twoFactorEnabled",
  "account.twoFactorDisabled",
  "account.twoFactorFailed",
] as const

export type TraceType = (typeof TRACE_TYPES)[number]

/** A folder as it was when the trace was written; null is the library root. */
export type TraceFolderRef = { id: string; name: string } | null

/** A token key (connected browser) as named when the trace was written. */
export type TraceKeyRef = { id: string; name: string }

/** What a trace keeps beyond its ids, snapshotted so it survives renames and
 *  deleted folders: the previous and new name of a rename, the origin and
 *  destination of a move, the sources of a merge, the token key (browser)
 *  a browser or sign-in trace concerns and why a refusal happened, and how
 *  an account signed in. Null for the other types. */
export type TraceDetails =
  | { from: string; to: string }
  | { from: TraceFolderRef; to: TraceFolderRef }
  | { sources: { id: string; name: string }[] }
  | { key: TraceKeyRef }
  | { key: TraceKeyRef; platform: string }
  | { key: TraceKeyRef; reason: "wrong-code" | "locked-out" }
  | { name: string; reason: "used" | "expired" }
  | { method: "password" | "sso"; userAgent: string | null }
  | { reason: "wrong-password" | "banned" }

// Audit trail of a user's actions: one row per action, written in the same
// transaction as the action and never updated or deleted by the API.
export const traceEvents = pgTable(
  "trace_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").$type<TraceType>().notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    // Documents and certificates are soft-deleted, so these rows survive them.
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "cascade",
    }),
    certificateId: uuid("certificate_id").references(() => certificates.id, {
      onDelete: "cascade",
    }),
    // The version the action produced or delivered.
    versionId: uuid("version_id").references(() => documentVersions.id, {
      onDelete: "cascade",
    }),
    ipAddress: text("ip_address"),
    details: jsonb("details").$type<TraceDetails>(),
  },
  (table) => [
    index("traceEvents_userId_occurredAt_idx").on(
      table.userId,
      table.occurredAt,
      table.id
    ),
    index("traceEvents_documentId_idx").on(table.documentId),
    index("traceEvents_certificateId_idx").on(table.certificateId),
  ]
)

export type TraceEvent = typeof traceEvents.$inferSelect
export type NewTraceEvent = typeof traceEvents.$inferInsert
