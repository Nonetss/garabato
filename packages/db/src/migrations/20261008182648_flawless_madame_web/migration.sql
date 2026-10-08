CREATE TABLE "document_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_tag_assignments" (
	"document_id" uuid,
	"tag_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_tag_assignments_pkey" PRIMARY KEY("document_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "document_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'neutral' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_documents" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "document_documents" ADD COLUMN "pinned_at" timestamp;--> statement-breakpoint
CREATE INDEX "documentFolders_userId_idx" ON "document_folders" ("user_id");--> statement-breakpoint
CREATE INDEX "documentFolders_parentId_idx" ON "document_folders" ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentFolders_sibling_name_idx" ON "document_folders" ("user_id",coalesce("parent_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("name"));--> statement-breakpoint
CREATE INDEX "documentTagAssignments_tagId_idx" ON "document_tag_assignments" ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentTags_name_idx" ON "document_tags" ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "documents_folderId_idx" ON "document_documents" ("folder_id");--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_parent_id_document_folders_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "document_folders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_tag_assignments" ADD CONSTRAINT "document_tag_assignments_document_id_document_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_tag_assignments" ADD CONSTRAINT "document_tag_assignments_tag_id_document_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "document_tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_documents" ADD CONSTRAINT "document_documents_folder_id_document_folders_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE SET NULL;