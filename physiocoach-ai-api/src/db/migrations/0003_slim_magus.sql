CREATE TABLE "coach_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"client_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"sender_name" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_pain_alert" boolean DEFAULT false NOT NULL,
	"pain_score" integer,
	"joint_region" text,
	"related_session_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_pain_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"pain_score" integer NOT NULL,
	"joint_region" text NOT NULL,
	"exercise_name" text,
	"session_date" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"clinical_note" text,
	"resolved_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "coach_messages_coach_id_idx" ON "coach_messages" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_messages_client_id_idx" ON "coach_messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "coach_messages_created_at_idx" ON "coach_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "coach_pain_alerts_coach_id_idx" ON "coach_pain_alerts" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_pain_alerts_client_id_idx" ON "coach_pain_alerts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "coach_pain_alerts_status_idx" ON "coach_pain_alerts" USING btree ("status");