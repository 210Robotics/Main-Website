CREATE TABLE "discord_calendar_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"calendar_event_id" text NOT NULL,
	"event_title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"reminder_window_hours" integer NOT NULL,
	"channel_id" text NOT NULL,
	"discord_message_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"type" integer NOT NULL,
	"parent_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text,
	"discord_user_id" text,
	"kind" text NOT NULL,
	"command_name" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_guild_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_hash" text,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"linked_member_id" uuid,
	"registration_reminder_sent_at" timestamp with time zone,
	"registration_reminder_count" integer DEFAULT 0 NOT NULL,
	"reminders_opted_out" boolean DEFAULT false NOT NULL,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Discord server' NOT NULL,
	"icon_hash" text,
	"member_count" integer DEFAULT 0 NOT NULL,
	"linked_member_count" integer DEFAULT 0 NOT NULL,
	"general_channel_id" text,
	"calendar_announcements_enabled" boolean DEFAULT true NOT NULL,
	"calendar_reminder_hours" integer DEFAULT 24 NOT NULL,
	"installed_by_discord_user_id" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_link_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"username" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"channel_name" text DEFAULT 'unknown-channel' NOT NULL,
	"author_discord_user_id" text NOT NULL,
	"author_username" text NOT NULL,
	"author_display_name" text NOT NULL,
	"author_is_bot" boolean DEFAULT false NOT NULL,
	"linked_member_id" uuid,
	"content" text DEFAULT '' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discord_created_at" timestamp with time zone NOT NULL,
	"discord_edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"first_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"period" text NOT NULL,
	"amount_due_cents" integer DEFAULT 0 NOT NULL,
	"amount_paid_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'DUE' NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"payment_method" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_calendar_reminders" ADD CONSTRAINT "discord_calendar_reminders_guild_id_discord_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_channels" ADD CONSTRAINT "discord_channels_guild_id_discord_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_events" ADD CONSTRAINT "discord_events_guild_id_discord_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD CONSTRAINT "discord_guild_members_guild_id_discord_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_guild_members" ADD CONSTRAINT "discord_guild_members_linked_member_id_members_id_fk" FOREIGN KEY ("linked_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_link_tokens" ADD CONSTRAINT "discord_link_tokens_guild_id_discord_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_messages" ADD CONSTRAINT "discord_messages_guild_id_discord_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_messages" ADD CONSTRAINT "discord_messages_linked_member_id_members_id_fk" FOREIGN KEY ("linked_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD CONSTRAINT "membership_dues_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_dues" ADD CONSTRAINT "membership_dues_updated_by_member_id_members_id_fk" FOREIGN KEY ("updated_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discord_calendar_reminder_once_idx" ON "discord_calendar_reminders" USING btree ("guild_id","calendar_event_id","reminder_window_hours");--> statement-breakpoint
CREATE INDEX "discord_calendar_reminder_date_idx" ON "discord_calendar_reminders" USING btree ("guild_id","sent_at");--> statement-breakpoint
CREATE INDEX "discord_channel_guild_position_idx" ON "discord_channels" USING btree ("guild_id","position");--> statement-breakpoint
CREATE INDEX "discord_event_kind_date_idx" ON "discord_events" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "discord_event_guild_date_idx" ON "discord_events" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "discord_guild_member_identity_idx" ON "discord_guild_members" USING btree ("guild_id","discord_user_id");--> statement-breakpoint
CREATE INDEX "discord_guild_member_linked_idx" ON "discord_guild_members" USING btree ("linked_member_id");--> statement-breakpoint
CREATE INDEX "discord_guild_member_active_idx" ON "discord_guild_members" USING btree ("guild_id","left_at");--> statement-breakpoint
CREATE INDEX "discord_link_token_user_idx" ON "discord_link_tokens" USING btree ("guild_id","discord_user_id");--> statement-breakpoint
CREATE INDEX "discord_link_token_expiry_idx" ON "discord_link_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "discord_message_guild_date_idx" ON "discord_messages" USING btree ("guild_id","discord_created_at");--> statement-breakpoint
CREATE INDEX "discord_message_channel_date_idx" ON "discord_messages" USING btree ("channel_id","discord_created_at");--> statement-breakpoint
CREATE INDEX "discord_message_author_date_idx" ON "discord_messages" USING btree ("author_discord_user_id","discord_created_at");--> statement-breakpoint
CREATE INDEX "discord_message_member_date_idx" ON "discord_messages" USING btree ("linked_member_id","discord_created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_dues_member_period_idx" ON "membership_dues" USING btree ("member_id","period");--> statement-breakpoint
CREATE INDEX "membership_dues_period_status_idx" ON "membership_dues" USING btree ("period","status");--> statement-breakpoint
CREATE INDEX "membership_dues_member_idx" ON "membership_dues" USING btree ("member_id");