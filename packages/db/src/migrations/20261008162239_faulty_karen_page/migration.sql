CREATE TYPE "certificate_key_algorithm" AS ENUM('RSA', 'EC');--> statement-breakpoint
CREATE TABLE "certificate_certificates" (
	"id" uuid PRIMARY KEY,
	"user_id" text NOT NULL,
	"alias" text NOT NULL,
	"common_name" text NOT NULL,
	"given_name" text,
	"surname" text,
	"tax_id" text,
	"issuer_common_name" text NOT NULL,
	"serial_number" text NOT NULL,
	"fingerprint_sha256" text NOT NULL,
	"key_algorithm" "certificate_key_algorithm" NOT NULL,
	"not_before" timestamp NOT NULL,
	"not_after" timestamp NOT NULL,
	"encrypted_data_key" bytea,
	"encrypted_p12" bytea,
	"encrypted_password" bytea,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_items" DROP CONSTRAINT "collection_items_collection_id_collections_id_fkey";--> statement-breakpoint
DROP TABLE "collections";--> statement-breakpoint
DROP TABLE "collection_items";--> statement-breakpoint
CREATE INDEX "certificates_userId_idx" ON "certificate_certificates" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_userId_fingerprint_active_idx" ON "certificate_certificates" ("user_id","fingerprint_sha256") WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "certificate_certificates" ADD CONSTRAINT "certificate_certificates_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;