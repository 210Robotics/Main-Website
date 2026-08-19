CREATE TABLE "membership_dues_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_dues_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"stripe_checkout_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"amount_cents" integer NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_dues_payments_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "dues_enforcement_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "dues_paid_role_id" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "dues_unpaid_role_id" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "dues_public_channel_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "dues_last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "manual_amount_paid_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "membership_dues" SET "manual_amount_paid_cents" = "amount_paid_cents";--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD CONSTRAINT "membership_dues_payments_membership_dues_id_membership_dues_id_fk" FOREIGN KEY ("membership_dues_id") REFERENCES "public"."membership_dues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD CONSTRAINT "membership_dues_payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_dues_payment_dues_idx" ON "membership_dues_payments" USING btree ("membership_dues_id");--> statement-breakpoint
CREATE INDEX "membership_dues_payment_member_idx" ON "membership_dues_payments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "membership_dues_payment_intent_idx" ON "membership_dues_payments" USING btree ("stripe_payment_intent_id");
