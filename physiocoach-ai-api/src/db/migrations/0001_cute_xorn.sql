CREATE TABLE "coach_assigned_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"client_user_id" text,
	"workout_plan_id" text NOT NULL,
	"clinical_notes" text,
	"assigned_at" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"client_user_id" text,
	"client_email" text NOT NULL,
	"client_name" text NOT NULL,
	"injury_diagnosis" text NOT NULL,
	"discharge_date" text,
	"status" text DEFAULT 'active' NOT NULL,
	"compliance_score" real DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"clinic_name" text,
	"specialty" text,
	"license_number" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_assigned_plans_coach_idx" ON "coach_assigned_plans" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_assigned_plans_client_idx" ON "coach_assigned_plans" USING btree ("client_user_id");--> statement-breakpoint
CREATE INDEX "coach_clients_coach_id_idx" ON "coach_clients" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_clients_client_user_id_idx" ON "coach_clients" USING btree ("client_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_profiles_user_id_unique" ON "coach_profiles" USING btree ("user_id");