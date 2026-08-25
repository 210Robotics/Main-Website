CREATE TABLE "membership_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"academic_year" text NOT NULL,
	"coverage_type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"grace_ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_settings" (
	"id" text PRIMARY KEY DEFAULT 'membership' NOT NULL,
	"membership_year" text DEFAULT '2026-2027' NOT NULL,
	"semester_dues_cents" integer DEFAULT 3000 NOT NULL,
	"annual_dues_cents" integer DEFAULT 5000 NOT NULL,
	"fundraising_waiver_threshold_cents" integer DEFAULT 10000 NOT NULL,
	"grace_period_days" integer DEFAULT 30 NOT NULL,
	"access_enforcement_enabled" boolean DEFAULT false NOT NULL,
	"updated_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"source" text DEFAULT 'SCHEDULED' NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"records_changed" integer DEFAULT 0 NOT NULL,
	"error" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ALTER COLUMN "stripe_checkout_session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "linked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "last_synchronized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "guild_membership_status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "nickname_sync_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "role_sync_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "last_sync_error" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "unverified_role_id" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "utsa_verified_role_id" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "verified_member_role_id" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "suspended_role_id" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "verification_enforcement_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "verification_public_channel_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "normalized_university_email" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "university_email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "university_email_override_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "university_email_override_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "university_email_override_reason" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "academic_level" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "major" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "expected_graduation_year" integer;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "team_interests" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "profile_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "access_state" text DEFAULT 'ACCOUNT_CREATED' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "access_state_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "access_state_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "membership_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "grace_period_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "nickname_sync_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "discord_nickname_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "membership_period_id" text;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "coverage_type" text DEFAULT 'ANNUAL_DUES' NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "fundraising_raised_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "fundraising_threshold_cents" integer DEFAULT 10000 NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "waiver_type" text;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "waiver_reason" text;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "waived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "waiver_granted_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD COLUMN "paid_before_waiver_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "payment_type" text DEFAULT 'SEMESTER_DUES' NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "coverage_type" text DEFAULT 'SEMESTER' NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "coverage_period" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "payment_method" text DEFAULT 'STRIPE' NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "payment_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "transaction_reference" text;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "receipt_number" text;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "provider_receipt_url" text;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "proof_pathname" text;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "proof_filename" text;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "proof_mime_type" text;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "proof_bytes" integer;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "entered_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_settings" ADD CONSTRAINT "membership_settings_updated_by_member_id_members_id_fk" FOREIGN KEY ("updated_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_period_year_active_idx" ON "membership_periods" USING btree ("academic_year","is_active");--> statement-breakpoint
CREATE INDEX "sync_job_status_attempt_idx" ON "sync_job_runs" USING btree ("job","status","attempted_at");--> statement-breakpoint
ALTER TABLE "membership_dues" ADD CONSTRAINT "membership_dues_membership_period_id_membership_periods_id_fk" FOREIGN KEY ("membership_period_id") REFERENCES "public"."membership_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD CONSTRAINT "membership_dues_waiver_granted_by_member_id_members_id_fk" FOREIGN KEY ("waiver_granted_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_dues_payments" ADD CONSTRAINT "membership_dues_payments_entered_by_member_id_members_id_fk" FOREIGN KEY ("entered_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_verified_university_email_idx" ON "members" USING btree ("normalized_university_email") WHERE "members"."normalized_university_email" is not null;--> statement-breakpoint
CREATE INDEX "member_access_state_idx" ON "members" USING btree ("access_state","status");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_dues_receipt_number_idx" ON "membership_dues_payments" USING btree ("receipt_number") WHERE "membership_dues_payments"."receipt_number" is not null;--> statement-breakpoint
CREATE INDEX "membership_dues_payment_date_idx" ON "membership_dues_payments" USING btree ("member_id","payment_date");
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_university_email_override_by_member_id_members_id_fk" FOREIGN KEY ("university_email_override_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "membership_settings" (
  "id", "membership_year", "semester_dues_cents", "annual_dues_cents",
  "fundraising_waiver_threshold_cents", "grace_period_days",
  "access_enforcement_enabled"
) VALUES ('membership', '2026-2027', 3000, 5000, 10000, 30, false)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "membership_periods" (
  "id", "label", "academic_year", "coverage_type", "amount_cents",
  "starts_at", "ends_at", "grace_ends_at", "is_active"
) VALUES
  ('fall-2026', 'Fall 2026', '2026-2027', 'SEMESTER', 3000, '2026-08-01T00:00:00-05:00', '2026-12-31T23:59:59-06:00', '2026-10-01T23:59:59-05:00', true),
  ('spring-2027', 'Spring 2027', '2026-2027', 'SEMESTER', 3000, '2027-01-01T00:00:00-06:00', '2027-05-31T23:59:59-05:00', '2027-02-15T23:59:59-06:00', true),
  ('annual-2026-2027', '2026-2027 Academic Year', '2026-2027', 'ANNUAL', 5000, '2026-08-01T00:00:00-05:00', '2027-07-31T23:59:59-05:00', '2026-10-01T23:59:59-05:00', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "members"
SET
  "first_name" = CASE
    WHEN position(' ' in trim("display_name")) > 0 THEN split_part(trim("display_name"), ' ', 1)
    ELSE trim("display_name")
  END,
  "last_name" = CASE
    WHEN position(' ' in trim("display_name")) > 0 THEN regexp_replace(trim("display_name"), '^\\S+\\s+', '')
    ELSE ''
  END,
  "access_state" = CASE
    WHEN "status" = 'SUSPENDED' THEN 'SUSPENDED'
    WHEN "status" = 'ACTIVE' THEN 'ADMIN_REVIEW'
    ELSE 'UTSA_EMAIL_PENDING'
  END,
  "access_state_reason" = CASE
    WHEN "status" = 'ACTIVE' THEN 'Existing member retained during controlled verification migration.'
    ELSE 'Complete the new membership verification workflow.'
  END,
  "grace_period_ends_at" = CASE
    WHEN "status" = 'ACTIVE' THEN '2026-10-01T23:59:59-05:00'::timestamptz
    ELSE NULL
  END,
  "access_state_updated_at" = now();
--> statement-breakpoint
UPDATE "discord_guild_members"
SET
  "linked_at" = COALESCE("linked_at", "updated_at"),
  "last_synchronized_at" = COALESCE("last_synchronized_at", "last_seen_at"),
  "guild_membership_status" = CASE WHEN "left_at" IS NULL THEN 'ACTIVE' ELSE 'LEFT' END,
  "role_sync_status" = CASE WHEN "linked_member_id" IS NULL THEN 'UNLINKED' ELSE 'PENDING' END,
  "nickname_sync_status" = CASE WHEN "linked_member_id" IS NULL THEN 'UNLINKED' ELSE 'PENDING' END
WHERE "linked_member_id" IS NOT NULL OR "left_at" IS NOT NULL;
--> statement-breakpoint
UPDATE "membership_dues"
SET
  "membership_period_id" = CASE WHEN "period" = '2026-2027' THEN 'annual-2026-2027' ELSE NULL END,
  "coverage_type" = 'ANNUAL_DUES',
  "fundraising_threshold_cents" = 10000;
--> statement-breakpoint
UPDATE "membership_dues_payments"
SET
  "payment_type" = 'ANNUAL_DUES',
  "coverage_type" = 'ANNUAL',
  "coverage_period" = COALESCE((SELECT "period" FROM "membership_dues" WHERE "membership_dues"."id" = "membership_dues_payments"."membership_dues_id"), ''),
  "payment_method" = 'STRIPE',
  "payment_date" = COALESCE("paid_at", "created_at"),
  "transaction_reference" = COALESCE("stripe_payment_intent_id", "stripe_checkout_session_id"),
  "receipt_number" = '210-DUES-' || upper(substr(replace("id"::text, '-', ''), 1, 12));
