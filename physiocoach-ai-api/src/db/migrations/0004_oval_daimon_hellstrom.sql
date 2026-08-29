CREATE TABLE "workout_plan_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"workout_plan_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_plan_ratings" ADD CONSTRAINT "workout_plan_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_plan_ratings_plan_idx" ON "workout_plan_ratings" USING btree ("workout_plan_id");--> statement-breakpoint
CREATE INDEX "workout_plan_ratings_user_idx" ON "workout_plan_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_plan_ratings_plan_user_unique" ON "workout_plan_ratings" USING btree ("workout_plan_id","user_id");