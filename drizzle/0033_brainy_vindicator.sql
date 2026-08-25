CREATE TABLE "discord_verification_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"university_email" text NOT NULL,
	"academic_level" text NOT NULL,
	"dues_method" text DEFAULT 'NOT_YET_PAID' NOT NULL,
	"status" text DEFAULT 'PENDING_PORTAL_VERIFICATION' NOT NULL,
	"linked_member_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_member_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_verification_applications" ADD CONSTRAINT "discord_verification_applications_guild_id_discord_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_verification_applications" ADD CONSTRAINT "discord_verification_applications_linked_member_id_members_id_fk" FOREIGN KEY ("linked_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_verification_applications" ADD CONSTRAINT "discord_verification_applications_reviewed_by_member_id_members_id_fk" FOREIGN KEY ("reviewed_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discord_verification_application_identity_idx" ON "discord_verification_applications" USING btree ("guild_id","discord_user_id");--> statement-breakpoint
CREATE INDEX "discord_verification_application_status_idx" ON "discord_verification_applications" USING btree ("status","submitted_at");