CREATE TABLE "gallery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"event_date" timestamp with time zone,
	"drive_folder_id" text,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "gallery_events_drive_folder_id_unique" UNIQUE("drive_folder_id")
);
--> statement-breakpoint
ALTER TABLE "engineering_notebook_entries" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "gallery_event_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "gallery_event_id" uuid;--> statement-breakpoint
CREATE INDEX "gallery_event_published_order_idx" ON "gallery_events" USING btree ("published","sort_order","event_date");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_gallery_event_id_gallery_events_id_fk" FOREIGN KEY ("gallery_event_id") REFERENCES "public"."gallery_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notebook_entry_order_idx" ON "engineering_notebook_entries" USING btree ("season_id","sort_order");