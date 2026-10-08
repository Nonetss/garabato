CREATE TABLE "document_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"document_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"certificate_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"signed_at" timestamp NOT NULL,
	"visible" boolean NOT NULL,
	"pages" integer[] NOT NULL,
	"rect" jsonb,
	"reason" text,
	"location" text,
	"sha256_before" text NOT NULL,
	"sha256_after" text NOT NULL,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"document_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"object_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_documents" (
	"id" uuid PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"page_count" integer NOT NULL,
	"encrypted_data_key" bytea,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "documentSignatures_documentId_idx" ON "document_signatures" ("document_id");--> statement-breakpoint
CREATE INDEX "documentSignatures_certificateId_idx" ON "document_signatures" ("certificate_id");--> statement-breakpoint
CREATE INDEX "documentSignatures_userId_idx" ON "document_signatures" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentVersions_documentId_number_idx" ON "document_versions" ("document_id","number");--> statement-breakpoint
CREATE INDEX "documents_userId_idx" ON "document_documents" ("user_id");--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_document_id_document_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_version_id_document_versions_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_s0ongOwCZ3wK_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificate_certificates"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_document_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_documents" ADD CONSTRAINT "document_documents_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;