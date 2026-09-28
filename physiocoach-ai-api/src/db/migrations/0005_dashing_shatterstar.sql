CREATE TABLE "explore_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"split" text NOT NULL,
	"frequency_days" integer NOT NULL,
	"experience_level" text NOT NULL,
	"equipment_json" text NOT NULL,
	"joint_tags_json" text NOT NULL,
	"target_personas_json" text NOT NULL,
	"total_weekly_sets" integer NOT NULL,
	"author_name" text DEFAULT 'PhysioCoach AI' NOT NULL,
	"author_role" text DEFAULT 'Official Clinical System' NOT NULL,
	"author_verified" boolean DEFAULT true NOT NULL,
	"clone_count" integer DEFAULT 0 NOT NULL,
	"rating" real DEFAULT 5 NOT NULL,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"is_verified" boolean DEFAULT true NOT NULL,
	"summary" text,
	"safety_notes_json" text NOT NULL,
	"progression_json" text,
	"days_json" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "explore_plans_frequency_days_idx" ON "explore_plans" USING btree ("frequency_days");--> statement-breakpoint
CREATE INDEX "explore_plans_split_idx" ON "explore_plans" USING btree ("split");--> statement-breakpoint
CREATE INDEX "explore_plans_is_verified_idx" ON "explore_plans" USING btree ("is_verified");