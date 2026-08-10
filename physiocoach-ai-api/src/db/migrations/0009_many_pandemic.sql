CREATE TABLE `exercise_duplicate_review_groups` (
	`catalog_version_id` text NOT NULL,
	`normalized_name` text NOT NULL,
	`source_ids_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`catalog_version_id`, `normalized_name`),
	FOREIGN KEY (`catalog_version_id`) REFERENCES `exercise_catalog_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `exercise_catalog_versions` ADD `review_revision` integer DEFAULT 0 NOT NULL;