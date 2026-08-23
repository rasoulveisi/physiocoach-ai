CREATE TABLE "ai_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"trace_id" text NOT NULL,
	"user_id" text,
	"task" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt" text NOT NULL,
	"completion" text,
	"status" text NOT NULL,
	"error_message" text,
	"schema_issues_json" text,
	"input_hash" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"latency_ms" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_considerations" (
	"assessment_id" text NOT NULL,
	"consideration_id" text NOT NULL,
	"severity" text NOT NULL,
	"side" text DEFAULT 'unspecified' NOT NULL,
	"notes" text,
	"inferred" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "assessment_considerations_assessment_id_consideration_id_pk" PRIMARY KEY("assessment_id","consideration_id")
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"goals_json" text NOT NULL,
	"frequency_days" integer NOT NULL,
	"equipment_json" text NOT NULL,
	"limitations_json" text NOT NULL,
	"posture_flags_json" text NOT NULL,
	"completed_at" text NOT NULL,
	"input_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"email" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_refresh_token_history" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"previous_refresh_token_hash" text,
	"previous_refresh_rotated_at" text,
	"absolute_expires_at" text NOT NULL,
	"idle_expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "body_considerations" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"group_code" text NOT NULL,
	"body_region" text NOT NULL,
	"kind" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"severity_enabled" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_catalog_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_repository" text NOT NULL,
	"source_commit_sha" text NOT NULL,
	"dataset_sha256" text NOT NULL,
	"source_record_count" integer NOT NULL,
	"imported_record_count" integer DEFAULT 0 NOT NULL,
	"rejected_record_count" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"analysis_version" text NOT NULL,
	"review_revision" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"activated_at" text
);
--> statement-breakpoint
CREATE TABLE "exercise_consideration_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL,
	"consideration_id" text NOT NULL,
	"severity" text NOT NULL,
	"rating" text NOT NULL,
	"reason" text NOT NULL,
	"required_modification" text,
	"confidence" real,
	"analysis_source" text NOT NULL,
	"rule_codes_json" text,
	"analysis_version" text NOT NULL,
	"manual_override" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_equipment" (
	"exercise_id" text NOT NULL,
	"equipment_id" text NOT NULL,
	CONSTRAINT "exercise_equipment_exercise_id_equipment_id_pk" PRIMARY KEY("exercise_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workout_session_id" text NOT NULL,
	"exercise_name" text NOT NULL,
	"master_exercise_id" text,
	"movement_pattern" text NOT NULL,
	"muscle_groups_json" text NOT NULL,
	"set_index" integer NOT NULL,
	"target_reps" text,
	"reps" integer NOT NULL,
	"weight" real NOT NULL,
	"rpe" real,
	"completed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"exercise_type" text DEFAULT 'working' NOT NULL,
	"previous_performance_json" text
);
--> statement-breakpoint
CREATE TABLE "exercise_media" (
	"id" text PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL,
	"storage_url" text NOT NULL,
	"media_type" text NOT NULL,
	"width_px" integer,
	"height_px" integer,
	"alt_text" text,
	"storage_provider" text,
	"object_key" text,
	"content_hash" text,
	"ownership_status" text,
	"review_status" text,
	"version" integer,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"license_name" text,
	"license_url" text,
	"license_author" text,
	"attribution_text" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_muscles" (
	"exercise_id" text NOT NULL,
	"muscle_id" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	CONSTRAINT "exercise_muscles_exercise_id_muscle_id_pk" PRIMARY KEY("exercise_id","muscle_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_safety_profiles" (
	"exercise_id" text NOT NULL,
	"analysis_version" text NOT NULL,
	"review_status" text NOT NULL,
	"global_rating" text NOT NULL,
	"coverage_complete" boolean DEFAULT false NOT NULL,
	"confidence" real,
	"summary_reason" text,
	"analysis_source" text NOT NULL,
	"manual_override" boolean DEFAULT false NOT NULL,
	"reviewed_by" text,
	"reviewed_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "exercise_safety_profiles_exercise_id_analysis_version_pk" PRIMARY KEY("exercise_id","analysis_version")
);
--> statement-breakpoint
CREATE TABLE "master_equipment" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_id" text NOT NULL,
	"name" text NOT NULL,
	"name_localized" text,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"license_name" text,
	"license_url" text,
	"license_author" text,
	"attribution_text" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_id" text NOT NULL,
	"name" text NOT NULL,
	"name_localized" text,
	"movement_pattern" text NOT NULL,
	"recommended_level" text,
	"goal_tags_json" text,
	"excluded_limitations_json" text,
	"instructions" text,
	"catalog_version_id" text,
	"body_part" text,
	"target" text,
	"primary_muscle" text,
	"secondary_muscles_json" text,
	"instructions_json" text,
	"attributes_json" text,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"license_name" text,
	"license_url" text,
	"license_author" text,
	"attribution_text" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_muscles" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_id" text NOT NULL,
	"name" text NOT NULL,
	"name_localized" text,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"license_name" text,
	"license_url" text,
	"license_author" text,
	"attribution_text" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"age" integer NOT NULL,
	"sex" text NOT NULL,
	"height_cm" real NOT NULL,
	"weight_kg" real NOT NULL,
	"body_fat_estimate" real,
	"lifestyle" text NOT NULL,
	"experience_level" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"theme" text NOT NULL,
	"unit_system" text NOT NULL,
	"default_workout_view" text NOT NULL,
	"reminders_enabled" boolean DEFAULT false NOT NULL,
	"rest_timer_seconds" integer DEFAULT 90 NOT NULL,
	"auto_start_rest_timer" boolean DEFAULT true NOT NULL,
	"rest_timer_sound_enabled" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"assessment_id" text NOT NULL,
	"status" text NOT NULL,
	"plan_json" text NOT NULL,
	"safety_warnings_json" text NOT NULL,
	"ai_metadata_json" text NOT NULL,
	"version" integer NOT NULL,
	"input_hash" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workout_plan_id" text NOT NULL,
	"day_index" integer NOT NULL,
	"status" text NOT NULL,
	"scheduled_date" text NOT NULL,
	"idempotency_key" text,
	"started_at" text,
	"completed_at" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "assessment_considerations" ADD CONSTRAINT "assessment_considerations_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_considerations" ADD CONSTRAINT "assessment_considerations_consideration_id_body_considerations_id_fk" FOREIGN KEY ("consideration_id") REFERENCES "public"."body_considerations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_accounts" ADD CONSTRAINT "auth_oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_refresh_token_history" ADD CONSTRAINT "auth_refresh_token_history_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_consideration_ratings" ADD CONSTRAINT "exercise_consideration_ratings_exercise_id_master_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."master_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_consideration_ratings" ADD CONSTRAINT "exercise_consideration_ratings_consideration_id_body_considerations_id_fk" FOREIGN KEY ("consideration_id") REFERENCES "public"."body_considerations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exercise_id_master_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."master_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipment_id_master_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."master_equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_workout_session_id_workout_sessions_id_fk" FOREIGN KEY ("workout_session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exercise_id_master_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."master_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_exercise_id_master_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."master_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_muscle_id_master_muscles_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."master_muscles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_safety_profiles" ADD CONSTRAINT "exercise_safety_profiles_exercise_id_master_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."master_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_exercises" ADD CONSTRAINT "master_exercises_catalog_version_id_exercise_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."exercise_catalog_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_workout_plan_id_workout_plans_id_fk" FOREIGN KEY ("workout_plan_id") REFERENCES "public"."workout_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_audit_logs_created_at_idx" ON "ai_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_audit_logs_trace_id_idx" ON "ai_audit_logs" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "ai_audit_logs_user_id_idx" ON "ai_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_credentials_user_id_unique" ON "auth_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_oauth_accounts_provider_user_unique" ON "auth_oauth_accounts" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "auth_refresh_token_history_session_idx" ON "auth_refresh_token_history" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_refresh_token_history_token_hash_unique" ON "auth_refresh_token_history" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_refresh_hash_idx" ON "auth_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_previous_refresh_hash_idx" ON "auth_sessions" USING btree ("previous_refresh_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "body_considerations_code_unique" ON "body_considerations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_consideration_ratings_exercise_consideration_severity_version_unique" ON "exercise_consideration_ratings" USING btree ("exercise_id","consideration_id","severity","analysis_version");--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_user_id_unique" ON "user_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workout_sessions_user_day_idx" ON "workout_sessions" USING btree ("user_id","workout_plan_id","day_index","scheduled_date");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sessions_idempotency_key_unique" ON "workout_sessions" USING btree ("idempotency_key");