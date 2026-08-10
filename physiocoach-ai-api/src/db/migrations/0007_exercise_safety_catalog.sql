CREATE TABLE `assessment_considerations` (
	`assessment_id` text NOT NULL,
	`consideration_id` text NOT NULL,
	`severity` text NOT NULL,
	`side` text DEFAULT 'unspecified' NOT NULL,
	`notes` text,
	`inferred` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`assessment_id`, `consideration_id`),
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consideration_id`) REFERENCES `body_considerations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `body_considerations` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`display_name` text NOT NULL,
	`group_code` text NOT NULL,
	`body_region` text NOT NULL,
	`kind` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`severity_enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `body_considerations_code_unique` ON `body_considerations` (`code`);--> statement-breakpoint
CREATE TABLE `exercise_analysis_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_id` text NOT NULL,
	`analysis_run_id` text,
	`analysis_version` text NOT NULL,
	`evidence_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `master_exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analysis_run_id`) REFERENCES `exercise_analysis_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercise_analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`catalog_version_id` text NOT NULL,
	`analysis_version` text NOT NULL,
	`status` text NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`approved_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`review_required_count` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`catalog_version_id`) REFERENCES `exercise_catalog_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercise_catalog_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_repository` text NOT NULL,
	`source_commit_sha` text NOT NULL,
	`dataset_sha256` text NOT NULL,
	`source_record_count` integer NOT NULL,
	`imported_record_count` integer DEFAULT 0 NOT NULL,
	`rejected_record_count` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`analysis_version` text NOT NULL,
	`created_at` text NOT NULL,
	`activated_at` text
);
--> statement-breakpoint
CREATE TABLE `exercise_consideration_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_id` text NOT NULL,
	`consideration_id` text NOT NULL,
	`severity` text NOT NULL,
	`rating` text NOT NULL,
	`reason` text NOT NULL,
	`required_modification` text,
	`confidence` real,
	`analysis_source` text NOT NULL,
	`rule_codes_json` text,
	`analysis_version` text NOT NULL,
	`manual_override` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `master_exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consideration_id`) REFERENCES `body_considerations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_consideration_ratings_exercise_consideration_severity_version_unique` ON `exercise_consideration_ratings` (`exercise_id`,`consideration_id`,`severity`,`analysis_version`);--> statement-breakpoint
CREATE TABLE `exercise_safety_profiles` (
	`exercise_id` text NOT NULL,
	`analysis_version` text NOT NULL,
	`review_status` text NOT NULL,
	`global_rating` text NOT NULL,
	`coverage_complete` integer DEFAULT 0 NOT NULL,
	`confidence` real,
	`summary_reason` text,
	`analysis_source` text NOT NULL,
	`manual_override` integer DEFAULT 0 NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`exercise_id`, `analysis_version`),
	FOREIGN KEY (`exercise_id`) REFERENCES `master_exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `exercise_media` ADD `storage_provider` text;--> statement-breakpoint
ALTER TABLE `exercise_media` ADD `object_key` text;--> statement-breakpoint
ALTER TABLE `exercise_media` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `exercise_media` ADD `ownership_status` text;--> statement-breakpoint
ALTER TABLE `exercise_media` ADD `review_status` text;--> statement-breakpoint
ALTER TABLE `exercise_media` ADD `version` integer;--> statement-breakpoint
ALTER TABLE `master_exercises` ADD `catalog_version_id` text REFERENCES exercise_catalog_versions(id);--> statement-breakpoint
ALTER TABLE `master_exercises` ADD `body_part` text;--> statement-breakpoint
ALTER TABLE `master_exercises` ADD `target` text;--> statement-breakpoint
ALTER TABLE `master_exercises` ADD `primary_muscle` text;--> statement-breakpoint
ALTER TABLE `master_exercises` ADD `secondary_muscles_json` text;--> statement-breakpoint
ALTER TABLE `master_exercises` ADD `instructions_json` text;--> statement-breakpoint
ALTER TABLE `master_exercises` ADD `attributes_json` text;
