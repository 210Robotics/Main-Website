ALTER TABLE "availability_poll_responses" ADD COLUMN "email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "public_form_responses" ADD COLUMN "respondent_name" text DEFAULT 'Anonymous' NOT NULL;--> statement-breakpoint
ALTER TABLE "public_form_responses" ADD COLUMN "respondent_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "public_form_responses" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "public_form_responses" AS response SET "respondent_name" = member."display_name", "respondent_email" = member."email" FROM "members" AS member WHERE response."submitted_by_member_id" = member."id";--> statement-breakpoint
UPDATE "availability_poll_responses" AS response SET "email" = member."email" FROM "members" AS member WHERE response."submitted_by_member_id" = member."id";
