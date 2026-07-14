CREATE TABLE "time_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"clock_in" timestamp with time zone DEFAULT now() NOT NULL,
	"clock_out" timestamp with time zone,
	"project" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"hour_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_sessions" ADD CONSTRAINT "time_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_sessions" ADD CONSTRAINT "time_sessions_hour_entry_id_hour_entries_id_fk" FOREIGN KEY ("hour_entry_id") REFERENCES "public"."hour_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "time_session_member_clock_idx" ON "time_sessions" USING btree ("member_id","clock_in");
--> statement-breakpoint
UPDATE "projects"
SET "slug" = 'roborowdy',
    "name" = 'RoboRowdy',
    "description" = 'Autonomous print-farm robotics, software, testing, and continued development'
WHERE "slug" = 'operations';
