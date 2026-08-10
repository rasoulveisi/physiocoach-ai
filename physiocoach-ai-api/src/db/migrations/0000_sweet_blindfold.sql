CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goals_json` text NOT NULL,
	`frequency_days` integer NOT NULL,
	`equipment_json` text NOT NULL,
	`limitations_json` text NOT NULL,
	`posture_flags_json` text NOT NULL,
	`completed_at` text NOT NULL,
	`input_hash` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `body_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`measured_at` text NOT NULL,
	`body_weight_kg` real NOT NULL,
	`body_fat_estimate` real,
	`neck_cm` real,
	`shoulders_cm` real,
	`chest_cm` real,
	`waist_cm` real,
	`hips_cm` real,
	`upper_arm_left_cm` real,
	`upper_arm_right_cm` real,
	`forearm_left_cm` real,
	`forearm_right_cm` real,
	`thigh_left_cm` real,
	`thigh_right_cm` real,
	`calf_left_cm` real,
	`calf_right_cm` real,
	`notes` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercise_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workout_session_id` text NOT NULL,
	`exercise_name` text NOT NULL,
	`movement_pattern` text NOT NULL,
	`muscle_groups_json` text NOT NULL,
	`set_index` integer NOT NULL,
	`target_reps` text,
	`reps` integer NOT NULL,
	`weight` real NOT NULL,
	`rpe` real,
	`completed` integer DEFAULT 0 NOT NULL,
	`notes` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`age` integer NOT NULL,
	`sex` text NOT NULL,
	`height_cm` real NOT NULL,
	`weight_kg` real NOT NULL,
	`body_fat_estimate` real,
	`lifestyle` text NOT NULL,
	`experience_level` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`theme` text NOT NULL,
	`unit_system` text NOT NULL,
	`default_workout_view` text NOT NULL,
	`reminders_enabled` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`legacy_auth_user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_legacy_auth_user_id_unique` ON `users` (`legacy_auth_user_id`);--> statement-breakpoint
CREATE TABLE `workout_plan_generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`request_payload_json` text NOT NULL,
	`request_hash` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`workout_plan_id` text,
	`error_code` text,
	`error_message` text,
	`status_logs_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	`poll_expires_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workout_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`assessment_id` text NOT NULL,
	`status` text NOT NULL,
	`plan_json` text NOT NULL,
	`safety_warnings_json` text NOT NULL,
	`ai_metadata_json` text NOT NULL,
	`version` integer NOT NULL,
	`input_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workout_plan_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`status` text NOT NULL,
	`scheduled_date` text NOT NULL,
	`idempotency_key` text,
	`started_at` text,
	`completed_at` text,
	`notes` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE no action
);
