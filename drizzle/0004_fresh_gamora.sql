CREATE TABLE `student_sync_identities` (
	`student_id` integer PRIMARY KEY NOT NULL,
	`sync_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_sync_identities_sync_id_unique` ON `student_sync_identities` (`sync_id`);--> statement-breakpoint
CREATE TABLE `sync_imported_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_uid` text NOT NULL,
	`source_device_id` text NOT NULL,
	`local_event_id` integer NOT NULL,
	`imported_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`local_event_id`) REFERENCES `learning_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_imported_events_event_uid_unique` ON `sync_imported_events` (`event_uid`);--> statement-breakpoint
CREATE INDEX `sync_imported_events_local_idx` ON `sync_imported_events` (`local_event_id`);--> statement-breakpoint
CREATE TABLE `sync_imported_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_device_id` text NOT NULL,
	`source_session_id` integer NOT NULL,
	`local_session_id` integer NOT NULL,
	`imported_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`local_session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_imported_sessions_source_unique` ON `sync_imported_sessions` (`source_device_id`,`source_session_id`);--> statement-breakpoint
CREATE INDEX `sync_imported_sessions_local_idx` ON `sync_imported_sessions` (`local_session_id`);--> statement-breakpoint
CREATE TABLE `sync_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`package_id` text NOT NULL,
	`source_device_id` text NOT NULL,
	`student_sync_id` text NOT NULL,
	`exported_at` integer NOT NULL,
	`imported_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`summary` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_imports_package_unique` ON `sync_imports` (`package_id`);--> statement-breakpoint
CREATE INDEX `sync_imports_student_imported_idx` ON `sync_imports` (`student_sync_id`,`imported_at`);