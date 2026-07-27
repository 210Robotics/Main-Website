CREATE TABLE "operations_hub_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"owner_member_id" uuid,
	"subject_member_id" uuid,
	"season_id" uuid,
	"project_id" uuid,
	"subsystem_id" uuid,
	"part_id" uuid,
	"due_at" timestamp with time zone,
	"occurred_at" timestamp with time zone,
	"source_type" text,
	"source_id" text,
	"source_url" text,
	"fingerprint" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_member_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operations_hub_records" ADD CONSTRAINT "operations_hub_records_owner_member_id_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_hub_records" ADD CONSTRAINT "operations_hub_records_subject_member_id_members_id_fk" FOREIGN KEY ("subject_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_hub_records" ADD CONSTRAINT "operations_hub_records_season_id_engineering_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."engineering_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_hub_records" ADD CONSTRAINT "operations_hub_records_project_id_engineering_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."engineering_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_hub_records" ADD CONSTRAINT "operations_hub_records_subsystem_id_engineering_subsystems_id_fk" FOREIGN KEY ("subsystem_id") REFERENCES "public"."engineering_subsystems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_hub_records" ADD CONSTRAINT "operations_hub_records_part_id_engineering_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."engineering_parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_hub_records" ADD CONSTRAINT "operations_hub_records_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operations_hub_kind_status_idx" ON "operations_hub_records" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "operations_hub_owner_due_idx" ON "operations_hub_records" USING btree ("owner_member_id","due_at");--> statement-breakpoint
CREATE INDEX "operations_hub_subject_kind_idx" ON "operations_hub_records" USING btree ("subject_member_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "operations_hub_fingerprint_idx" ON "operations_hub_records" USING btree ("kind","fingerprint") WHERE "operations_hub_records"."fingerprint" is not null;