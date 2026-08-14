CREATE TABLE `ai_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`task` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt` text NOT NULL,
	`completion` text,
	`status` text NOT NULL,
	`error_message` text,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`total_tokens` integer,
	`latency_ms` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_audit_logs_created_at_idx` ON `ai_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_audit_logs_user_id_idx` ON `ai_audit_logs` (`user_id`);