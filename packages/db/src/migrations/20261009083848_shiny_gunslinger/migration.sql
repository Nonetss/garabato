CREATE TABLE "trace_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"document_id" uuid,
	"certificate_id" uuid,
	"version_id" uuid,
	"ip_address" text,
	"details" jsonb
);
--> statement-breakpoint
CREATE INDEX "traceEvents_userId_occurredAt_idx" ON "trace_events" ("user_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "traceEvents_documentId_idx" ON "trace_events" ("document_id");--> statement-breakpoint
CREATE INDEX "traceEvents_certificateId_idx" ON "trace_events" ("certificate_id");--> statement-breakpoint
ALTER TABLE "trace_events" ADD CONSTRAINT "trace_events_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trace_events" ADD CONSTRAINT "trace_events_document_id_document_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trace_events" ADD CONSTRAINT "trace_events_certificate_id_certificate_certificates_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificate_certificates"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trace_events" ADD CONSTRAINT "trace_events_version_id_document_versions_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE;