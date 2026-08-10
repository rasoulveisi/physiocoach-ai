CREATE TABLE `master_muscles` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_id` text NOT NULL,
	`name` text NOT NULL,
	`name_localized` text,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`license_name` text,
	`license_url` text,
	`license_author` text,
	`attribution_text` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `master_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_id` text NOT NULL,
	`name` text NOT NULL,
	`name_localized` text,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`license_name` text,
	`license_url` text,
	`license_author` text,
	`attribution_text` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `master_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_id` text NOT NULL,
	`name` text NOT NULL,
	`name_localized` text,
	`movement_pattern` text NOT NULL,
	`instructions` text,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`license_name` text,
	`license_url` text,
	`license_author` text,
	`attribution_text` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exercise_muscles` (
	`exercise_id` text NOT NULL,
	`muscle_id` text NOT NULL,
	`is_primary` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`exercise_id`, `muscle_id`),
	FOREIGN KEY (`exercise_id`) REFERENCES `master_exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`muscle_id`) REFERENCES `master_muscles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercise_equipment` (
	`exercise_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	PRIMARY KEY(`exercise_id`, `equipment_id`),
	FOREIGN KEY (`exercise_id`) REFERENCES `master_exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `master_equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercise_media` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_id` text NOT NULL,
	`storage_url` text NOT NULL,
	`media_type` text NOT NULL,
	`width_px` integer,
	`height_px` integer,
	`alt_text` text,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`license_name` text,
	`license_url` text,
	`license_author` text,
	`attribution_text` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `master_exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercise_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_id` text NOT NULL,
	`alias` text NOT NULL,
	`locale` text,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`license_name` text,
	`license_url` text,
	`license_author` text,
	`attribution_text` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `master_exercises`(`id`) ON UPDATE no action ON DELETE no action
);
