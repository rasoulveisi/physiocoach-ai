CREATE TABLE "coach_client_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"license_id" text,
	"coach_id" text NOT NULL,
	"client_email" text NOT NULL,
	"client_name" text NOT NULL,
	"invite_token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"redeemed_at" text,
	"redeemed_user_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_seat_licenses" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"tier" text NOT NULL,
	"total_seats" integer NOT NULL,
	"used_seats" integer DEFAULT 0 NOT NULL,
	"invite_code" text,
	"stripe_checkout_session_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_client_invites" ADD CONSTRAINT "coach_client_invites_license_id_coach_seat_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."coach_seat_licenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_client_invites_invite_token_unique" ON "coach_client_invites" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX "coach_client_invites_coach_id_idx" ON "coach_client_invites" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_client_invites_license_id_idx" ON "coach_client_invites" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "coach_seat_licenses_coach_id_idx" ON "coach_seat_licenses" USING btree ("coach_id");