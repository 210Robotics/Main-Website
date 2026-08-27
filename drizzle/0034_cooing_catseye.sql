CREATE TABLE "discord_reaction_role_panels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"mappings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_reaction_role_panels" ADD CONSTRAINT "discord_reaction_role_panels_guild_id_discord_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_reaction_role_panels" ADD CONSTRAINT "discord_reaction_role_panels_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discord_reaction_role_panel_guild_idx" ON "discord_reaction_role_panels" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discord_reaction_role_panel_message_idx" ON "discord_reaction_role_panels" USING btree ("guild_id","message_id");