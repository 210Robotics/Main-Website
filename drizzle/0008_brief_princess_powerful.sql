CREATE TYPE "public"."activity_status" AS ENUM('SCHEDULED', 'CANCELED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('EVENT', 'WORKSHOP', 'MEETING', 'OUTREACH', 'TRAINING');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."doc_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."doc_visibility" AS ENUM('PUBLIC', 'MEMBERS_ONLY');--> statement-breakpoint
CREATE TABLE "activity_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'PRESENT' NOT NULL,
	"method" text DEFAULT 'QR_LINK' NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by_member_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"voided_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by_member_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "doc_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "doc_editor_locks" (
	"page_id" uuid PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body_json" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"body_html" text DEFAULT '<p></p>' NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"visibility" "doc_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"status" "doc_status" DEFAULT 'DRAFT' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"author_member_id" uuid,
	"last_editor_member_id" uuid,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_pages_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "doc_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"editor_member_id" uuid,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body_json" jsonb NOT NULL,
	"body_html" text NOT NULL,
	"visibility" "doc_visibility" NOT NULL,
	"status" "doc_status" NOT NULL,
	"reason" text DEFAULT 'autosave' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "activity_type" NOT NULL,
	"topic" text,
	"location" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"status" "activity_status" DEFAULT 'SCHEDULED' NOT NULL,
	"attendance_opened_at" timestamp with time zone,
	"attendance_closes_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_activities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "activity_attendance" ADD CONSTRAINT "activity_attendance_activity_id_team_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."team_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_attendance" ADD CONSTRAINT "activity_attendance_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_attendance" ADD CONSTRAINT "activity_attendance_recorded_by_member_id_members_id_fk" FOREIGN KEY ("recorded_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_tokens" ADD CONSTRAINT "attendance_tokens_activity_id_team_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."team_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_tokens" ADD CONSTRAINT "attendance_tokens_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_editor_locks" ADD CONSTRAINT "doc_editor_locks_page_id_doc_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."doc_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_editor_locks" ADD CONSTRAINT "doc_editor_locks_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_pages" ADD CONSTRAINT "doc_pages_category_id_doc_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."doc_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_pages" ADD CONSTRAINT "doc_pages_author_member_id_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_pages" ADD CONSTRAINT "doc_pages_last_editor_member_id_members_id_fk" FOREIGN KEY ("last_editor_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_revisions" ADD CONSTRAINT "doc_revisions_page_id_doc_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."doc_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_revisions" ADD CONSTRAINT "doc_revisions_editor_member_id_members_id_fk" FOREIGN KEY ("editor_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_attendance_member_idx" ON "activity_attendance" USING btree ("activity_id","member_id");--> statement-breakpoint
CREATE INDEX "member_attendance_history_idx" ON "activity_attendance" USING btree ("member_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "attendance_token_activity_idx" ON "attendance_tokens" USING btree ("activity_id","created_at");--> statement-breakpoint
CREATE INDEX "doc_category_order_idx" ON "doc_categories" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_page_category_slug_idx" ON "doc_pages" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "doc_page_visibility_status_idx" ON "doc_pages" USING btree ("visibility","status");--> statement-breakpoint
CREATE INDEX "doc_page_category_order_idx" ON "doc_pages" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE INDEX "doc_revision_page_created_idx" ON "doc_revisions" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE INDEX "team_activity_start_idx" ON "team_activities" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "team_activity_public_idx" ON "team_activities" USING btree ("is_public","status");
--> statement-breakpoint
INSERT INTO "doc_categories" ("slug", "title", "description", "sort_order") VALUES
  ('engineering-notebook', 'Engineering Notebook', 'Design decisions, tests, and iteration history.', 10),
  ('vex-u', 'VEX U', 'Competition, hardware, and game documentation.', 20),
  ('code-documentation', 'Code Documentation', 'Software architecture, controls, and programming guides.', 30),
  ('training', 'Training', 'Design, programming, build, and safety training.', 40),
  ('team-operations', 'Team Documentation', 'Onboarding, standards, and organization knowledge.', 50)
ON CONFLICT ("slug") DO NOTHING;
