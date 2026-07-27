CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sponsorship" text NOT NULL,
	"tier" text DEFAULT 'Partner' NOT NULL,
	"website_url" text,
	"logo_url" text,
	"logo_media_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_logo_media_id_media_assets_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sponsors_published_order_idx" ON "sponsors" USING btree ("published","sort_order");--> statement-breakpoint
INSERT INTO "sponsors" ("name", "sponsorship", "tier", "website_url", "logo_url", "sort_order", "published") VALUES
	('Siemens', 'Technology and mentorship', 'Partner', 'https://www.siemens.com/', '/media/sponsors/siemens.png', 10, true),
	('UT San Antonio', 'University support', 'Partner', 'https://www.utsa.edu/', '/media/sponsors/utsa.png', 20, true),
	('Onshape', 'Cloud CAD', 'Partner', 'https://www.onshape.com/', '/media/sponsors/onshape.svg', 30, true);
