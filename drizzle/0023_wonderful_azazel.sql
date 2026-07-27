CREATE TABLE "donation_campaign_settings" (
	"id" text PRIMARY KEY DEFAULT 'primary' NOT NULL,
	"title" text DEFAULT 'Power the next build.' NOT NULL,
	"description" text DEFAULT 'Help 210 Robotics fund competition travel, robot parts, tools, and student-led engineering.' NOT NULL,
	"goal_cents" integer DEFAULT 1000000 NOT NULL,
	"suggested_amounts_cents" jsonb DEFAULT '[500, 1000, 2500, 5000, 10000]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text DEFAULT 'primary' NOT NULL,
	"stripe_checkout_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"amount_cents" integer NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"donor_name" text,
	"donor_email" text,
	"donor_message" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donation_campaign_settings" ADD CONSTRAINT "donation_campaign_settings_updated_by_member_id_members_id_fk" FOREIGN KEY ("updated_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_donation_campaign_settings_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."donation_campaign_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "donation_checkout_session_idx" ON "donations" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donation_payment_intent_idx" ON "donations" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "donation_campaign_status_paid_idx" ON "donations" USING btree ("campaign_id","status","paid_at");