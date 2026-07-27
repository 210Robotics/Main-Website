CREATE TYPE "public"."public_form_status" AS ENUM('DRAFT', 'OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "public_form_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"submitted_by_member_id" uuid,
	"request_fingerprint" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_key" text NOT NULL,
	"title" text NOT NULL,
	"description_html" text DEFAULT '<p></p>' NOT NULL,
	"confirmation_message" text DEFAULT 'Thanks! Your response has been recorded.' NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "public_form_status" DEFAULT 'DRAFT' NOT NULL,
	"response_count" integer DEFAULT 0 NOT NULL,
	"created_by_member_id" uuid,
	"last_editor_member_id" uuid,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_forms_access_key_unique" UNIQUE("access_key")
);
--> statement-breakpoint
ALTER TABLE "public_form_responses" ADD CONSTRAINT "public_form_responses_form_id_public_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."public_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_form_responses" ADD CONSTRAINT "public_form_responses_submitted_by_member_id_members_id_fk" FOREIGN KEY ("submitted_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_forms" ADD CONSTRAINT "public_forms_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_forms" ADD CONSTRAINT "public_forms_last_editor_member_id_members_id_fk" FOREIGN KEY ("last_editor_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_form_response_form_date_idx" ON "public_form_responses" USING btree ("form_id","submitted_at");--> statement-breakpoint
CREATE INDEX "public_form_response_rate_idx" ON "public_form_responses" USING btree ("form_id","request_fingerprint","submitted_at");--> statement-breakpoint
CREATE INDEX "public_forms_status_updated_idx" ON "public_forms" USING btree ("status","updated_at");