CREATE TABLE `personal_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`master_exercise_id` text,
	`exercise_name` text NOT NULL,
	`record_type` text NOT NULL,
	`value` real NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`workout_session_id` text,
	`achieved_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `exercise_logs` ADD `exercise_type` text DEFAULT 'working' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercise_logs` ADD `previous_performance_json` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `rest_timer_seconds` integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `auto_start_rest_timer` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `rest_timer_sound_enabled` integer DEFAULT 1 NOT NULL;