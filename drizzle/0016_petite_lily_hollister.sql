CREATE TABLE "engineering_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project" text NOT NULL,
	"part_number" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"subsystem" text DEFAULT 'General' NOT NULL,
	"revision" text DEFAULT 'A' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"make_buy" text DEFAULT 'MAKE' NOT NULL,
	"material" text DEFAULT '' NOT NULL,
	"stock_size" text DEFAULT '' NOT NULL,
	"manufacturing_method" text DEFAULT '' NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"cad_status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"cam_status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"cae_status" text DEFAULT 'NOT_REQUIRED' NOT NULL,
	"drawing_status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"verification_status" text DEFAULT 'PENDING' NOT NULL,
	"lifecycle_status" text DEFAULT 'DESIGN' NOT NULL,
	"cad_url" text,
	"drawing_url" text,
	"source_url" text,
	"assigned_to_member_id" uuid,
	"due_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"kind" text DEFAULT 'EXPENSE' NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"description" text NOT NULL,
	"vendor" text DEFAULT '' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"receipt_url" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"project" text DEFAULT 'Organization' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"minimum_budget_cents" integer DEFAULT 0 NOT NULL,
	"maximum_budget_cents" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_sponsor_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"sponsor_name" text NOT NULL,
	"tier" text DEFAULT 'Partner' NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'PLEDGED' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"received_at" timestamp with time zone,
	"restrictions" text DEFAULT '' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "glossary_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"acronym" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"definition" text NOT NULL,
	"usage" text DEFAULT '' NOT NULL,
	"owner_role" text DEFAULT '' NOT NULL,
	"related_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "glossary_terms_term_unique" UNIQUE("term")
);
--> statement-breakpoint
CREATE TABLE "manufacturing_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"sequence" integer DEFAULT 10 NOT NULL,
	"process" text NOT NULL,
	"machine" text DEFAULT '' NOT NULL,
	"setup" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"inspection_criteria" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"assigned_to_member_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"impact" text DEFAULT '' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid,
	"title" text NOT NULL,
	"held_at" timestamp with time zone NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"facilitator" text DEFAULT '' NOT NULL,
	"agenda" text DEFAULT '' NOT NULL,
	"discussion" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"next_meeting" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid,
	"assigned_to_member_id" uuid NOT NULL,
	"created_by_member_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"project" text DEFAULT 'Organization' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"status" text DEFAULT 'TODO' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"is_deliverable" boolean DEFAULT false NOT NULL,
	"attachment_url" text,
	"attachment_pathname" text,
	"attachment_name" text,
	"attachment_mime_type" text,
	"attachment_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engineering_parts" ADD CONSTRAINT "engineering_parts_assigned_to_member_id_members_id_fk" FOREIGN KEY ("assigned_to_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_parts" ADD CONSTRAINT "engineering_parts_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_sponsor_commitments" ADD CONSTRAINT "finance_sponsor_commitments_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_sponsor_commitments" ADD CONSTRAINT "finance_sponsor_commitments_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_steps" ADD CONSTRAINT "manufacturing_steps_part_id_engineering_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."engineering_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_steps" ADD CONSTRAINT "manufacturing_steps_assigned_to_member_id_members_id_fk" FOREIGN KEY ("assigned_to_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_meeting_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_activity_id_team_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."team_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD CONSTRAINT "member_tasks_meeting_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting_notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD CONSTRAINT "member_tasks_assigned_to_member_id_members_id_fk" FOREIGN KEY ("assigned_to_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD CONSTRAINT "member_tasks_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_member_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."member_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "engineering_part_project_number_idx" ON "engineering_parts" USING btree ("project","part_number");--> statement-breakpoint
CREATE INDEX "engineering_part_project_subsystem_idx" ON "engineering_parts" USING btree ("project","subsystem");--> statement-breakpoint
CREATE INDEX "engineering_part_verification_idx" ON "engineering_parts" USING btree ("verification_status","lifecycle_status");--> statement-breakpoint
CREATE INDEX "finance_entry_plan_date_idx" ON "finance_entries" USING btree ("plan_id","occurred_at");--> statement-breakpoint
CREATE INDEX "finance_entry_kind_status_idx" ON "finance_entries" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "finance_plan_year_status_idx" ON "finance_plans" USING btree ("fiscal_year","status");--> statement-breakpoint
CREATE INDEX "finance_sponsor_plan_status_idx" ON "finance_sponsor_commitments" USING btree ("plan_id","status");--> statement-breakpoint
CREATE INDEX "glossary_category_term_idx" ON "glossary_terms" USING btree ("category","term");--> statement-breakpoint
CREATE UNIQUE INDEX "manufacturing_step_part_sequence_idx" ON "manufacturing_steps" USING btree ("part_id","sequence");--> statement-breakpoint
CREATE INDEX "manufacturing_step_status_idx" ON "manufacturing_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meeting_decision_meeting_idx" ON "meeting_decisions" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_notes_activity_idx" ON "meeting_notes" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "meeting_notes_date_status_idx" ON "meeting_notes" USING btree ("held_at","status");--> statement-breakpoint
CREATE INDEX "member_task_assignee_status_idx" ON "member_tasks" USING btree ("assigned_to_member_id","status");--> statement-breakpoint
CREATE INDEX "member_task_due_idx" ON "member_tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "member_task_meeting_idx" ON "member_tasks" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "task_comment_task_date_idx" ON "task_comments" USING btree ("task_id","created_at");