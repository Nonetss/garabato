CREATE TABLE "browser_token_settings" (
	"id" text PRIMARY KEY,
	"token_enabled" boolean DEFAULT true NOT NULL,
	"installs_enabled" boolean DEFAULT true NOT NULL,
	"min_module_version" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "browser_token_settings" ADD CONSTRAINT "browser_token_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL;