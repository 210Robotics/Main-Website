CREATE TABLE "university_email_verification_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"clerk_email_address_id" text NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"send_count" integer DEFAULT 1 NOT NULL,
	"send_window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "university_email_verification_challenges_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
ALTER TABLE "university_email_verification_challenges" ADD CONSTRAINT "university_email_verification_challenges_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "university_email_verification_expiry_idx" ON "university_email_verification_challenges" USING btree ("expires_at");