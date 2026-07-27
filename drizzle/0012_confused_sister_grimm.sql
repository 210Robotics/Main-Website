CREATE TYPE "public"."availability_poll_status" AS ENUM('DRAFT', 'OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "availability_poll_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"participant_key" uuid NOT NULL,
	"name" text NOT NULL,
	"available_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_by_member_id" uuid,
	"request_fingerprint" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_time" text DEFAULT '18:00' NOT NULL,
	"end_time" text DEFAULT '21:00' NOT NULL,
	"slot_minutes" integer DEFAULT 30 NOT NULL,
	"status" "availability_poll_status" DEFAULT 'DRAFT' NOT NULL,
	"response_count" integer DEFAULT 0 NOT NULL,
	"created_by_member_id" uuid,
	"last_editor_member_id" uuid,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_polls_access_key_unique" UNIQUE("access_key")
);
--> statement-breakpoint
CREATE TABLE "public_form_uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"form_id" uuid NOT NULL,
	"field_id" text NOT NULL,
	"response_id" uuid,
	"blob_url" text,
	"pathname" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"request_fingerprint" text NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_form_uploads_pathname_unique" UNIQUE("pathname")
);
--> statement-breakpoint
ALTER TABLE "availability_poll_responses" ADD CONSTRAINT "availability_poll_responses_poll_id_availability_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."availability_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_poll_responses" ADD CONSTRAINT "availability_poll_responses_submitted_by_member_id_members_id_fk" FOREIGN KEY ("submitted_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_polls" ADD CONSTRAINT "availability_polls_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_polls" ADD CONSTRAINT "availability_polls_last_editor_member_id_members_id_fk" FOREIGN KEY ("last_editor_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_form_uploads" ADD CONSTRAINT "public_form_uploads_form_id_public_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."public_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_form_uploads" ADD CONSTRAINT "public_form_uploads_response_id_public_form_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."public_form_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "availability_poll_participant_idx" ON "availability_poll_responses" USING btree ("poll_id","participant_key");--> statement-breakpoint
CREATE INDEX "availability_poll_response_date_idx" ON "availability_poll_responses" USING btree ("poll_id","updated_at");--> statement-breakpoint
CREATE INDEX "availability_poll_response_rate_idx" ON "availability_poll_responses" USING btree ("poll_id","request_fingerprint","updated_at");--> statement-breakpoint
CREATE INDEX "availability_poll_status_updated_idx" ON "availability_polls" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "public_form_upload_form_field_idx" ON "public_form_uploads" USING btree ("form_id","field_id");--> statement-breakpoint
CREATE INDEX "public_form_upload_response_idx" ON "public_form_uploads" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "public_form_upload_rate_idx" ON "public_form_uploads" USING btree ("form_id","request_fingerprint","created_at");