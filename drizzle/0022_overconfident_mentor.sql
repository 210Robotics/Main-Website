ALTER TABLE "posts" ADD COLUMN "gallery_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "embed_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;