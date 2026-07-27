ALTER TABLE "donation_campaign_settings" ALTER COLUMN "suggested_amounts_cents" SET DEFAULT '[100, 500, 1000, 2500, 5000, 10000, 21000, 50000]'::jsonb;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "club_210_shirt_size" text;--> statement-breakpoint
UPDATE "donation_campaign_settings"
SET "suggested_amounts_cents" = '[100, 500, 1000, 2500, 5000, 10000, 21000, 50000]'::jsonb,
    "updated_at" = now()
WHERE "id" = 'primary';
