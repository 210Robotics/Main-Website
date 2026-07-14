CREATE TYPE "public"."access_role" AS ENUM('MEMBER', 'OFFICER', 'CONTENT_ADMIN', 'RECORDS_ADMIN', 'FULL_ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'DELIVERED', 'BOUNCED', 'SUPPRESSED');--> statement-breakpoint
CREATE TYPE "public"."inquiry_kind" AS ENUM('contact', 'join', 'sponsor');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('NEW', 'IN_PROGRESS', 'CLOSED', 'SPAM');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_member_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_snapshots" (
	"id" text PRIMARY KEY DEFAULT 'shared' NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"contribution_date" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"project" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"evidence_url" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"provider_id" text,
	"status" "delivery_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hour_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"work_date" timestamp with time zone NOT NULL,
	"minutes" integer NOT NULL,
	"project" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"event_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "inquiry_kind" NOT NULL,
	"status" "inquiry_status" DEFAULT 'NEW' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"organization" text,
	"interest" text,
	"message" text NOT NULL,
	"source_path" text DEFAULT '/' NOT NULL,
	"request_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_file_id" text,
	"drive_modified_at" timestamp with time zone,
	"blob_url" text NOT NULL,
	"pathname" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"alt" text DEFAULT '210 Robotics team photo' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"album" text DEFAULT 'Team photos' NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"published" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_drive_file_id_unique" UNIQUE("drive_file_id"),
	CONSTRAINT "media_assets_pathname_unique" UNIQUE("pathname")
);
--> statement-breakpoint
CREATE TABLE "member_projects" (
	"member_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"contribution" text DEFAULT 'Contributor' NOT NULL,
	CONSTRAINT "member_projects_member_id_project_id_pk" PRIMARY KEY("member_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"organization_role" text DEFAULT 'Member' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"photo_url" text,
	"status" "member_status" DEFAULT 'PENDING' NOT NULL,
	"access_role" "access_role" DEFAULT 'MEMBER' NOT NULL,
	"permission_overrides" jsonb DEFAULT '{"allow":[],"deny":[]}'::jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "post_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"editor_member_id" uuid,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body_html" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body_html" text NOT NULL,
	"cover_media_id" uuid,
	"cover_image_url" text,
	"author_member_id" uuid,
	"status" "post_status" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_member_id_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hour_entries" ADD CONSTRAINT "hour_entries_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_projects" ADD CONSTRAINT "member_projects_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_projects" ADD CONSTRAINT "member_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_editor_member_id_members_id_fk" FOREIGN KEY ("editor_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_member_id_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contribution_member_date_idx" ON "contributions" USING btree ("member_id","contribution_date");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_inquiry_recipient_idx" ON "email_deliveries" USING btree ("inquiry_id","recipient");--> statement-breakpoint
CREATE INDEX "hour_member_date_idx" ON "hour_entries" USING btree ("member_id","work_date");--> statement-breakpoint
CREATE INDEX "inquiries_created_idx" ON "inquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inquiries_fingerprint_idx" ON "inquiries" USING btree ("request_fingerprint");--> statement-breakpoint
CREATE INDEX "posts_status_published_idx" ON "posts" USING btree ("status","published_at");
--> statement-breakpoint
INSERT INTO "projects" ("slug", "name", "description") VALUES
('vex-u', 'VEX U', 'Competition robotics program'),
('sidc', 'SIDC', 'Siemens Immersive Design Challenge and RoboRowdy'),
('operations', 'Operations', 'Organization leadership, outreach, finance, and logistics');
