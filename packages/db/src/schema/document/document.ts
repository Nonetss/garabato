import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  bytea,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "#schema/auth"
import { certificates } from "#schema/certificate"
import type { EntityIconColor } from "#schema/entity-icon"

/** A visible signature's rectangle, as fractions (0–1) of the displayed page. */
export type SignatureRect = {
  x: number
  y: number
  width: number
  height: number
}

// A user's folder tree. A null parent is a top-level folder (library root).
export const documentFolders = pgTable(
  "document_folders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Restrict: deleting a folder reparents its children first, so a missed
    // path fails instead of cascading into the subtree.
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => documentFolders.id,
      { onDelete: "restrict" }
    ),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("documentFolders_userId_idx").on(table.userId),
    index("documentFolders_parentId_idx").on(table.parentId),
    // Sibling names are unique ignoring case; the coalesce makes top-level
    // folders siblings of each other too.
    uniqueIndex("documentFolders_sibling_name_idx").on(
      table.userId,
      sql`coalesce(${table.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`lower(${table.name})`
    ),
  ]
)

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
    // Null is the library root.
    folderId: uuid("folder_id").references(() => documentFolders.id, {
      onDelete: "set null",
    }),
    // When the document was first pinned; null when not pinned.
    pinnedAt: timestamp("pinned_at"),
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
  (table) => [
    index("documents_userId_idx").on(table.userId),
    index("documents_folderId_idx").on(table.folderId),
  ]
)

/** What produced a document version. */
export type DocumentVersionKind = "upload" | "merge" | "signature" | "pages"

// Immutable versions: 1 is the upload or the merge, each signature or page
// edit adds the next one. Only the latest live version can be deleted, and
// only softly: the row stays so the traces and signature records that name it
// survive, and its number is never reused.
export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    kind: text("kind").$type<DocumentVersionKind>().notNull(),
    // Key of the sealed bytes in the object store.
    objectKey: text("object_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // Lowercase hex SHA-256 of the plaintext PDF.
    sha256: text("sha256").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Soft delete: a deleted version is no longer part of the document, and
    // its object has been removed from storage.
    deletedAt: timestamp("deleted_at"),
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
    // Time asserted by the RFC 3161 timestamp token (PAdES B-T) and the name
    // of the authority that issued it; both null for B-B signatures.
    timestampedAt: timestamp("timestamped_at"),
    timestampAuthority: text("timestamp_authority"),
  },
  (table) => [
    index("documentSignatures_documentId_idx").on(table.documentId),
    index("documentSignatures_certificateId_idx").on(table.certificateId),
    index("documentSignatures_userId_idx").on(table.userId),
  ]
)

// A user's labels for documents, painted with an entity icon palette key.
export const documentTags = pgTable(
  "document_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").$type<EntityIconColor>().notNull().default("neutral"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("documentTags_name_idx").on(
      table.userId,
      sql`lower(${table.name})`
    ),
  ]
)

// Which tags each document carries.
export const documentTagAssignments = pgTable(
  "document_tag_assignments",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => documentTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.tagId] }),
    index("documentTagAssignments_tagId_idx").on(table.tagId),
  ]
)

export type DocumentFolder = typeof documentFolders.$inferSelect
export type DocumentTag = typeof documentTags.$inferSelect
export type DocumentTagAssignment = typeof documentTagAssignments.$inferSelect
export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type DocumentVersion = typeof documentVersions.$inferSelect
export type DocumentSignature = typeof documentSignatures.$inferSelect
