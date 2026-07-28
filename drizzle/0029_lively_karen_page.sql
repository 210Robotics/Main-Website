ALTER TABLE "discord_guild_members" ADD COLUMN "onboarding_dm_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "security_delay_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "security_delay_notification_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "onboarding_roles_assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD COLUMN "onboarding_role_error" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "onboarding_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "security_delay_minutes" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "agreed_role_id" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "vex_u_member_role_id" text;--> statement-breakpoint
ALTER TABLE "public_settings" ADD COLUMN "constitution_document_id" uuid;--> statement-breakpoint
ALTER TABLE "public_settings" ADD COLUMN "constitution_version" text;--> statement-breakpoint
ALTER TABLE "public_settings" ADD COLUMN "constitution_effective_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "public_settings" ADD COLUMN "constitution_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "public_settings" ADD CONSTRAINT "public_settings_constitution_document_id_internal_documents_id_fk" FOREIGN KEY ("constitution_document_id") REFERENCES "public"."internal_documents"("id") ON DELETE set null ON UPDATE no action;