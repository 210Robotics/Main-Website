ALTER TYPE "public"."access_role" ADD VALUE 'OPERATIONS_LEAD' BEFORE 'DIRECTOR';--> statement-breakpoint
ALTER TYPE "public"."access_role" ADD VALUE 'ENGINEERING_LEAD' BEFORE 'DIRECTOR';--> statement-breakpoint
ALTER TYPE "public"."access_role" ADD VALUE 'FINANCE_LEAD' BEFORE 'DIRECTOR';--> statement-breakpoint
ALTER TYPE "public"."access_role" ADD VALUE 'OUTREACH_LEAD' BEFORE 'DIRECTOR';--> statement-breakpoint
ALTER TYPE "public"."access_role" ADD VALUE 'CONTENT_LEAD' BEFORE 'DIRECTOR';--> statement-breakpoint
ALTER TABLE "member_tasks" ADD COLUMN "completion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD COLUMN "completion_requested_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD COLUMN "approved_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD COLUMN "approval_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD CONSTRAINT "member_tasks_completion_requested_by_member_id_members_id_fk" FOREIGN KEY ("completion_requested_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD CONSTRAINT "member_tasks_approved_by_member_id_members_id_fk" FOREIGN KEY ("approved_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;