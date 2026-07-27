CREATE TABLE "internal_document_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"content_html" text NOT NULL,
	"reason" text DEFAULT 'Saved in document studio' NOT NULL,
	"editor_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"pathname" text NOT NULL,
	"content_html" text DEFAULT '<p></p>' NOT NULL,
	"editable" boolean DEFAULT false NOT NULL,
	"embedded_assets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"storage_provider" text DEFAULT 'BLOB' NOT NULL,
	"drive_file_id" text,
	"drive_web_view_link" text,
	"drive_modified_at" timestamp with time zone,
	"drive_sync_status" text DEFAULT 'LOCAL_ONLY' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_by_member_id" uuid,
	"updated_by_member_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "internal_documents_pathname_unique" UNIQUE("pathname"),
	CONSTRAINT "internal_documents_drive_file_id_unique" UNIQUE("drive_file_id")
);
--> statement-breakpoint
ALTER TABLE "internal_document_revisions" ADD CONSTRAINT "internal_document_revisions_document_id_internal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."internal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_document_revisions" ADD CONSTRAINT "internal_document_revisions_editor_member_id_members_id_fk" FOREIGN KEY ("editor_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_updated_by_member_id_members_id_fk" FOREIGN KEY ("updated_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "internal_document_revision_number_idx" ON "internal_document_revisions" USING btree ("document_id","version_number");--> statement-breakpoint
CREATE INDEX "internal_document_category_updated_idx" ON "internal_documents" USING btree ("category","updated_at");--> statement-breakpoint
CREATE INDEX "internal_document_drive_status_idx" ON "internal_documents" USING btree ("drive_sync_status","updated_at");