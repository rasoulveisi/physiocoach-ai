CREATE TABLE "exercise_alternatives" (
	"id" text PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL,
	"alternative_exercise_id" text NOT NULL,
	"relationship_type" text NOT NULL,
	"reason" text,
	"rank" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_exercise_id_master_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."master_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_alternative_exercise_id_master_exercises_id_fk" FOREIGN KEY ("alternative_exercise_id") REFERENCES "public"."master_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_alternatives_pair_unique" ON "exercise_alternatives" USING btree ("exercise_id","alternative_exercise_id");--> statement-breakpoint
CREATE INDEX "exercise_alternatives_exercise_id_idx" ON "exercise_alternatives" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "exercise_alternatives_alt_id_idx" ON "exercise_alternatives" USING btree ("alternative_exercise_id");--> statement-breakpoint
CREATE INDEX "master_exercises_pattern_muscle_idx" ON "master_exercises" USING btree ("movement_pattern","primary_muscle");--> statement-breakpoint
CREATE INDEX "master_exercises_canonical_id_idx" ON "master_exercises" USING btree ("canonical_id");