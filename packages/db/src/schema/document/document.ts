import {
  boolean,
  bytea,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "#schema/auth"
import { certificates } from "#schema/certificate"

/** A visible signature's rectangle, as fractions (0–1) of the displayed page. */
export type SignatureRect = {
  x: number
  y: number
  width: number
  height: number
}

// A user's PDF document. Its versions live encrypted in object storage under
// a per-document data key, wrapped by the vault master key.
export const documents = pgTable(
  "document_documents",
  {
    // Assigned by the application: the stored objects are bound to the id.
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    pageCount: integer("page_count").notNull(),
    // Null only after deletion (crypto-shredding): the objects can no longer
    // be decrypted.
    encryptedDataKey: bytea("encrypted_data_key"),

    // Soft delete: the row survives so signature records keep its name.
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("documents_userId_idx").on(table.userId)]
)

// Immutable versions: 1 is the upload, each signature adds the next one.
export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    // Key of the sealed bytes in the object store.
    objectKey: text("object_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // Lowercase hex SHA-256 of the plaintext PDF.
    sha256: text("sha256").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Two signatures racing on the same version cannot both become `n + 1`.
    uniqueIndex("documentVersions_documentId_number_idx").on(
      table.documentId,
      table.number
    ),
  ]
)

// Audit trail: one row per signature, never updated or deleted by the API.
export const documentSignatures = pgTable(
  "document_signatures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    // The version this signature produced.
    versionId: uuid("version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    certificateId: uuid("certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    signedAt: timestamp("signed_at").notNull(),
    visible: boolean("visible").notNull(),
    // 0-based pages showing the stamp; empty for an invisible signature.
    pages: integer("pages").array().notNull(),
    rect: jsonb("rect").$type<SignatureRect>(),
    reason: text("reason"),
    location: text("location"),
    sha256Before: text("sha256_before").notNull(),
    sha256After: text("sha256_after").notNull(),
    ipAddress: text("ip_address"),
  },
  (table) => [
    index("documentSignatures_documentId_idx").on(table.documentId),
    index("documentSignatures_certificateId_idx").on(table.certificateId),
    index("documentSignatures_userId_idx").on(table.userId),
  ]
)

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type DocumentVersion = typeof documentVersions.$inferSelect
export type DocumentSignature = typeof documentSignatures.$inferSelect
