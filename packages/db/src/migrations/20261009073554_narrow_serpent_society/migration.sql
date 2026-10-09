ALTER TABLE "document_versions" ADD COLUMN "kind" text DEFAULT 'signature' NOT NULL;--> statement-breakpoint
UPDATE "document_versions" SET "kind" = 'upload' WHERE "number" = 1;--> statement-breakpoint
ALTER TABLE "document_versions" ALTER COLUMN "kind" DROP DEFAULT;