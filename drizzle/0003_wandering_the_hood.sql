CREATE TABLE "public_settings" (
	"id" text PRIMARY KEY DEFAULT 'site' NOT NULL,
	"member_count_override_enabled" boolean DEFAULT false NOT NULL,
	"member_count_override" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
