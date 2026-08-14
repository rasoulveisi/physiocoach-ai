ALTER TABLE `ai_audit_logs` ADD `trace_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_audit_logs` ADD `schema_issues_json` text;--> statement-breakpoint
ALTER TABLE `ai_audit_logs` ADD `input_hash` text;--> statement-breakpoint
CREATE INDEX `ai_audit_logs_trace_id_idx` ON `ai_audit_logs` (`trace_id`);