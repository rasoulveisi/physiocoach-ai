CREATE INDEX `workout_plan_generation_jobs_user_status_idx` ON `workout_plan_generation_jobs` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `workout_plan_generation_jobs_user_idx` ON `workout_plan_generation_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `workout_plan_generation_jobs_created_at_idx` ON `workout_plan_generation_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `workout_sessions_user_day_idx` ON `workout_sessions` (`user_id`,`workout_plan_id`,`day_index`,`scheduled_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `workout_sessions_idempotency_key_unique` ON `workout_sessions` (`idempotency_key`);