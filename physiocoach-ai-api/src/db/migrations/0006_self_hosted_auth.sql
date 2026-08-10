CREATE TABLE `auth_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_credentials_user_id_unique` ON `auth_credentials` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_oauth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`email` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_oauth_accounts_provider_user_unique` ON `auth_oauth_accounts` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`user_agent` text,
	`ip_hash` text,
	`previous_refresh_token_hash` text,
	`previous_refresh_rotated_at` text,
	`absolute_expires_at` text NOT NULL,
	`idle_expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_sessions_refresh_hash_idx` ON `auth_sessions` (`refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_previous_refresh_hash_idx` ON `auth_sessions` (`previous_refresh_token_hash`);--> statement-breakpoint
CREATE TABLE `auth_refresh_token_history` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `auth_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_refresh_token_history_session_idx` ON `auth_refresh_token_history` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_refresh_token_history_token_hash_unique` ON `auth_refresh_token_history` (`token_hash`);--> statement-breakpoint
DELETE FROM `exercise_logs`;--> statement-breakpoint
DELETE FROM `workout_sessions`;--> statement-breakpoint
DELETE FROM `workout_plan_generation_jobs`;--> statement-breakpoint
DELETE FROM `workout_plans`;--> statement-breakpoint
DELETE FROM `assessments`;--> statement-breakpoint
DELETE FROM `profiles`;--> statement-breakpoint
DELETE FROM `body_measurements`;--> statement-breakpoint
DELETE FROM `user_settings`;--> statement-breakpoint
DELETE FROM `users`;--> statement-breakpoint
DROP INDEX `users_legacy_auth_user_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `legacy_auth_user_id`;
