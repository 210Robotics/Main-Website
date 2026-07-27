ALTER TYPE "public"."access_role" ADD VALUE 'ENGINEERING_MEMBER' BEFORE 'ENGINEERING_LEAD';--> statement-breakpoint
ALTER TYPE "public"."access_role" ADD VALUE 'NOTEBOOK_EDITOR' BEFORE 'FINANCE_LEAD';--> statement-breakpoint
ALTER TYPE "public"."access_role" ADD VALUE 'SCOUTING_LEAD' BEFORE 'FINANCE_LEAD';--> statement-breakpoint
ALTER TYPE "public"."access_role" ADD VALUE 'LOGISTICS_LEAD' BEFORE 'FINANCE_LEAD';--> statement-breakpoint
CREATE TABLE "design_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid,
	"project_id" uuid,
	"subsystem_id" uuid,
	"part_id" uuid,
	"change_number" text NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"description" text NOT NULL,
	"impact" text DEFAULT '' NOT NULL,
	"cost_impact_cents" integer DEFAULT 0 NOT NULL,
	"schedule_impact_days" integer DEFAULT 0 NOT NULL,
	"risk" text DEFAULT 'MEDIUM' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"revision_from" text DEFAULT '' NOT NULL,
	"revision_to" text DEFAULT '' NOT NULL,
	"verification_plan" text DEFAULT '' NOT NULL,
	"verification_results" text DEFAULT '' NOT NULL,
	"requested_by_member_id" uuid NOT NULL,
	"approved_by_member_id" uuid,
	"approved_at" timestamp with time zone,
	"implemented_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_notebook_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" text DEFAULT 'COMMENT' NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_notebook_compilations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid,
	"project_id" uuid,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"filename" text NOT NULL,
	"compiled_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_notebook_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"project_id" uuid,
	"subsystem_id" uuid,
	"title" text NOT NULL,
	"entry_type" text DEFAULT 'DESIGN' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"entry_date" timestamp with time zone NOT NULL,
	"content_html" text DEFAULT '<p></p>' NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"decisions" text DEFAULT '' NOT NULL,
	"results" text DEFAULT '' NOT NULL,
	"next_steps" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_by_member_id" uuid,
	"updated_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_notebook_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_summary" text DEFAULT '' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"lead_member_id" uuid,
	"starts_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"competition" text DEFAULT 'VEX U' NOT NULL,
	"game_name" text DEFAULT 'Override' NOT NULL,
	"game_manual_version" text DEFAULT '1.0' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_subsystems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"lead_member_id" uuid,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid,
	"project_id" uuid,
	"subsystem_id" uuid,
	"part_id" uuid,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Robot parts' NOT NULL,
	"location" text DEFAULT 'Shop' NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"reorder_point" integer DEFAULT 0 NOT NULL,
	"unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid,
	"project_id" uuid,
	"subsystem_id" uuid,
	"inventory_item_id" uuid,
	"finance_plan_id" uuid,
	"finance_entry_id" uuid,
	"item" text NOT NULL,
	"category" text DEFAULT 'Robot parts' NOT NULL,
	"vendor" text DEFAULT '' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"estimated_unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"needed_by" timestamp with time zone,
	"requested_by_member_id" uuid NOT NULL,
	"approved_by_member_id" uuid,
	"approved_at" timestamp with time zone,
	"ordered_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scouting_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid,
	"event_name" text NOT NULL,
	"match_type" text DEFAULT 'QUALIFICATION' NOT NULL,
	"match_number" text NOT NULL,
	"observed_team" text NOT NULL,
	"alliance_color" text DEFAULT 'RED' NOT NULL,
	"result" text DEFAULT 'UNKNOWN' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"opponent_score" integer DEFAULT 0 NOT NULL,
	"autonomous_score" integer DEFAULT 0 NOT NULL,
	"autonomous_won" boolean DEFAULT false NOT NULL,
	"autonomous_win_point" boolean DEFAULT false NOT NULL,
	"auto_pins_scored" integer DEFAULT 0 NOT NULL,
	"auto_goals_with_two_pins" integer DEFAULT 0 NOT NULL,
	"auto_robots_midfield" integer DEFAULT 0 NOT NULL,
	"auto_contacted_perimeter" boolean DEFAULT false NOT NULL,
	"auto_violation" boolean DEFAULT false NOT NULL,
	"alliance_pins_scored" integer DEFAULT 0 NOT NULL,
	"yellow_pins_owned" integer DEFAULT 0 NOT NULL,
	"goals_used" integer DEFAULT 0 NOT NULL,
	"max_stack_height" integer DEFAULT 0 NOT NULL,
	"cups_used" integer DEFAULT 0 NOT NULL,
	"toggles_owned" integer DEFAULT 0 NOT NULL,
	"robots_midfield" integer DEFAULT 0 NOT NULL,
	"loader_pins" integer DEFAULT 0 NOT NULL,
	"loader_cups" integer DEFAULT 0 NOT NULL,
	"successful_cycles" integer DEFAULT 0 NOT NULL,
	"failed_cycles" integer DEFAULT 0 NOT NULL,
	"average_cycle_seconds" integer DEFAULT 0 NOT NULL,
	"descores" integer DEFAULT 0 NOT NULL,
	"penalties" integer DEFAULT 0 NOT NULL,
	"breakdowns" integer DEFAULT 0 NOT NULL,
	"offensive_rating" integer DEFAULT 3 NOT NULL,
	"defensive_rating" integer DEFAULT 3 NOT NULL,
	"coordination_rating" integer DEFAULT 3 NOT NULL,
	"reliability_rating" integer DEFAULT 3 NOT NULL,
	"large_robot_role" text DEFAULT '' NOT NULL,
	"small_robot_role" text DEFAULT '' NOT NULL,
	"scoring_pattern" text DEFAULT '' NOT NULL,
	"strengths" text DEFAULT '' NOT NULL,
	"weaknesses" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"submitted_by_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engineering_parts" ADD COLUMN "season_id" uuid;--> statement-breakpoint
ALTER TABLE "engineering_parts" ADD COLUMN "engineering_project_id" uuid;--> statement-breakpoint
ALTER TABLE "engineering_parts" ADD COLUMN "subsystem_id" uuid;--> statement-breakpoint
ALTER TABLE "finance_entries" ADD COLUMN "subsystem_id" uuid;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD COLUMN "season_id" uuid;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD COLUMN "engineering_project_id" uuid;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD COLUMN "engineering_project_id" uuid;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD COLUMN "subsystem_id" uuid;--> statement-breakpoint
ALTER TABLE "design_changes" ADD CONSTRAINT "design_changes_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_changes" ADD CONSTRAINT "design_changes_project_id_engineering_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_changes" ADD CONSTRAINT "design_changes_subsystem_id_engineering_subsystems_id_fk" FOREIGN KEY ("subsystem_id") REFERENCES "public"."engineering_subsystems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_changes" ADD CONSTRAINT "design_changes_part_id_engineering_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."engineering_parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_changes" ADD CONSTRAINT "design_changes_requested_by_member_id_members_id_fk" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_changes" ADD CONSTRAINT "design_changes_approved_by_member_id_members_id_fk" FOREIGN KEY ("approved_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_comments" ADD CONSTRAINT "engineering_notebook_comments_entry_id_engineering_notebook_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."engineering_notebook_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_comments" ADD CONSTRAINT "engineering_notebook_comments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_comments" ADD CONSTRAINT "engineering_notebook_comments_resolved_by_member_id_members_id_fk" FOREIGN KEY ("resolved_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_compilations" ADD CONSTRAINT "engineering_notebook_compilations_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_compilations" ADD CONSTRAINT "engineering_notebook_compilations_project_id_engineering_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_compilations" ADD CONSTRAINT "engineering_notebook_compilations_compiled_by_member_id_members_id_fk" FOREIGN KEY ("compiled_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_entries" ADD CONSTRAINT "engineering_notebook_entries_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_entries" ADD CONSTRAINT "engineering_notebook_entries_project_id_engineering_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_entries" ADD CONSTRAINT "engineering_notebook_entries_subsystem_id_engineering_subsystems_id_fk" FOREIGN KEY ("subsystem_id") REFERENCES "public"."engineering_subsystems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_entries" ADD CONSTRAINT "engineering_notebook_entries_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_entries" ADD CONSTRAINT "engineering_notebook_entries_updated_by_member_id_members_id_fk" FOREIGN KEY ("updated_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_versions" ADD CONSTRAINT "engineering_notebook_versions_entry_id_engineering_notebook_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."engineering_notebook_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_notebook_versions" ADD CONSTRAINT "engineering_notebook_versions_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_projects" ADD CONSTRAINT "engineering_projects_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_projects" ADD CONSTRAINT "engineering_projects_lead_member_id_members_id_fk" FOREIGN KEY ("lead_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_projects" ADD CONSTRAINT "engineering_projects_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_seasons" ADD CONSTRAINT "engineering_seasons_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_subsystems" ADD CONSTRAINT "engineering_subsystems_project_id_engineering_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_subsystems" ADD CONSTRAINT "engineering_subsystems_lead_member_id_members_id_fk" FOREIGN KEY ("lead_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_subsystems" ADD CONSTRAINT "engineering_subsystems_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_project_id_engineering_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_subsystem_id_engineering_subsystems_id_fk" FOREIGN KEY ("subsystem_id") REFERENCES "public"."engineering_subsystems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_part_id_engineering_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."engineering_parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_project_id_engineering_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_subsystem_id_engineering_subsystems_id_fk" FOREIGN KEY ("subsystem_id") REFERENCES "public"."engineering_subsystems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_finance_plan_id_finance_plans_id_fk" FOREIGN KEY ("finance_plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_finance_entry_id_finance_entries_id_fk" FOREIGN KEY ("finance_entry_id") REFERENCES "public"."finance_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requested_by_member_id_members_id_fk" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approved_by_member_id_members_id_fk" FOREIGN KEY ("approved_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scouting_matches" ADD CONSTRAINT "scouting_matches_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scouting_matches" ADD CONSTRAINT "scouting_matches_submitted_by_member_id_members_id_fk" FOREIGN KEY ("submitted_by_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "design_change_number_idx" ON "design_changes" USING btree ("change_number");--> statement-breakpoint
CREATE INDEX "design_change_status_idx" ON "design_changes" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "notebook_comment_entry_status_idx" ON "engineering_notebook_comments" USING btree ("entry_id","status");--> statement-breakpoint
CREATE INDEX "notebook_compilation_date_idx" ON "engineering_notebook_compilations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notebook_entry_scope_date_idx" ON "engineering_notebook_entries" USING btree ("season_id","project_id","entry_date");--> statement-breakpoint
CREATE INDEX "notebook_entry_status_idx" ON "engineering_notebook_entries" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notebook_version_entry_number_idx" ON "engineering_notebook_versions" USING btree ("entry_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "engineering_project_season_code_idx" ON "engineering_projects" USING btree ("season_id","code");--> statement-breakpoint
CREATE INDEX "engineering_project_status_idx" ON "engineering_projects" USING btree ("season_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "engineering_season_name_idx" ON "engineering_seasons" USING btree ("name");--> statement-breakpoint
CREATE INDEX "engineering_season_status_idx" ON "engineering_seasons" USING btree ("status","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "engineering_subsystem_project_code_idx" ON "engineering_subsystems" USING btree ("project_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_sku_idx" ON "inventory_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "inventory_stock_status_idx" ON "inventory_items" USING btree ("status","quantity_on_hand");--> statement-breakpoint
CREATE INDEX "purchase_status_needed_idx" ON "purchase_requests" USING btree ("status","needed_by");--> statement-breakpoint
CREATE INDEX "scouting_event_team_idx" ON "scouting_matches" USING btree ("event_name","observed_team");--> statement-breakpoint
CREATE INDEX "scouting_season_match_idx" ON "scouting_matches" USING btree ("season_id","match_number");--> statement-breakpoint
ALTER TABLE "engineering_parts" ADD CONSTRAINT "engineering_parts_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_parts" ADD CONSTRAINT "engineering_parts_engineering_project_id_engineering_projects_id_fk" FOREIGN KEY ("engineering_project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_parts" ADD CONSTRAINT "engineering_parts_subsystem_id_engineering_subsystems_id_fk" FOREIGN KEY ("subsystem_id") REFERENCES "public"."engineering_subsystems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_subsystem_id_engineering_subsystems_id_fk" FOREIGN KEY ("subsystem_id") REFERENCES "public"."engineering_subsystems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_engineering_project_id_engineering_projects_id_fk" FOREIGN KEY ("engineering_project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD CONSTRAINT "member_tasks_engineering_project_id_engineering_projects_id_fk" FOREIGN KEY ("engineering_project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD CONSTRAINT "member_tasks_subsystem_id_engineering_subsystems_id_fk" FOREIGN KEY ("subsystem_id") REFERENCES "public"."engineering_subsystems"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "engineering_seasons" (
	"name", "competition", "game_name", "game_manual_version", "status", "starts_at", "ends_at", "is_default"
) VALUES (
	'2026-27 Override', 'VEX U', 'Override', '1.0', 'ACTIVE', '2026-07-01T00:00:00Z', '2027-06-30T23:59:59Z', true
) ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "engineering_projects" ("season_id", "code", "name", "description", "status")
SELECT "id", 'VEXU', 'Override Competition Robots', 'Shared design, build, test, scouting, and competition project for the 2026-27 VEX U season.', 'ACTIVE'
FROM "engineering_seasons"
WHERE "name" = '2026-27 Override'
ON CONFLICT ("season_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "engineering_subsystems" ("project_id", "code", "name", "description", "status")
SELECT project."id", subsystem."code", subsystem."name", subsystem."description", 'ACTIVE'
FROM "engineering_projects" project
CROSS JOIN (VALUES
	('DRIVE', 'Drivetrain', 'Mobility, traction, odometry, and Midfield movement.'),
	('INTAKE', 'Pin and Cup Intake', 'Pin and Cup acquisition, transfer, and Loader interaction.'),
	('SCORE', 'Scoring Mechanism', 'Placement, stacking, and Goal interaction.'),
	('TOGGLE', 'Toggle Mechanism', 'Toggle manipulation and endgame strategy.'),
	('CONTROLS', 'Controls and Autonomy', 'Software, sensors, autonomous routines, and driver controls.'),
	('STRUCTURE', 'Structure and Integration', 'Frames, packaging, robot-to-robot coordination, and system integration.')
) AS subsystem("code", "name", "description")
WHERE project."code" = 'VEXU'
	AND project."season_id" = (SELECT "id" FROM "engineering_seasons" WHERE "name" = '2026-27 Override')
ON CONFLICT ("project_id", "code") DO NOTHING;
