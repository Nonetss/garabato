import { sql } from "drizzle-orm"
import {
  bytea,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "#schema/auth"

export const certificateKeyAlgorithmEnum = pgEnum("certificate_key_algorithm", [
  "RSA",
  "EC",
])

// A user's signing certificate (PKCS#12). Public metadata is stored in clear;
// the file and the optional remembered password only as AES-256-GCM sealed
// blobs under a per-row data key, itself wrapped by the vault master key.
export const certificates = pgTable(
  "certificate_certificates",
  {
    // Assigned by the application, not defaulted: the sealed blobs are bound
    // to the row id, so it must exist before they are encrypted.
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),

    commonName: text("common_name").notNull(),
    givenName: text("given_name"),
    surname: text("surname"),
    // NIF/NIE from the subject serialNumber, without the "IDCES-" prefix.
    taxId: text("tax_id"),
    issuerCommonName: text("issuer_common_name").notNull(),
    serialNumber: text("serial_number").notNull(),
    // Lowercase hex SHA-256 of the certificate DER, without separators.
    fingerprintSha256: text("fingerprint_sha256").notNull(),
    keyAlgorithm: certificateKeyAlgorithmEnum("key_algorithm").notNull(),
    notBefore: timestamp("not_before").notNull(),
    notAfter: timestamp("not_after").notNull(),

    // Null only after deletion (crypto-shredding).
    encryptedDataKey: bytea("encrypted_data_key"),
    encryptedP12: bytea("encrypted_p12"),
    // Null when the user chose not to remember the password.
    encryptedPassword: bytea("encrypted_password"),

    // Soft delete: the metadata row survives so signature records can still
    // name the certificate; the sealed blobs are erased in the same update.
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("certificates_userId_idx").on(table.userId),
    // Partial so a deleted certificate can be imported again.
    uniqueIndex("certificates_userId_fingerprint_active_idx")
      .on(table.userId, table.fingerprintSha256)
      .where(sql`${table.deletedAt} is null`),
  ]
)

export type Certificate = typeof certificates.$inferSelect
export type NewCertificate = typeof certificates.$inferInsert
