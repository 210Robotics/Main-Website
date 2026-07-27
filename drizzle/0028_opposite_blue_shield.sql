CREATE TABLE "discord_direct_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"direction" text DEFAULT 'INBOUND' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"reply_to_message_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"discord_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "discord_dm_user_date_idx" ON "discord_direct_messages" USING btree ("discord_user_id","discord_created_at");--> statement-breakpoint
CREATE INDEX "discord_dm_direction_date_idx" ON "discord_direct_messages" USING btree ("direction","discord_created_at");