-- v0.10 FSRS-lite migration.
-- Archive the legacy SM-2 `item_progress` table (rename rather than drop so
-- v0.10.x can roll back by renaming it back; the .rollback.sql file in the
-- same folder is the playbook). Then create the fresh FSRS-lite table —
-- existing student SM-2 state does NOT carry over (fresh start by design).
ALTER TABLE `item_progress` RENAME TO `item_progress_v1_archive`;
--> statement-breakpoint
DROP INDEX IF EXISTS `item_progress_next_due_idx`;
--> statement-breakpoint
CREATE TABLE `item_progress_v2` (
	`student_id` integer NOT NULL,
	`content_item_id` integer NOT NULL,
	`track` text DEFAULT 'curated' NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 5 NOT NULL,
	`state` text DEFAULT 'new' NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`last_seen_at` integer,
	`next_due_at` integer,
	`total_correct` integer DEFAULT 0 NOT NULL,
	`total_wrong` integer DEFAULT 0 NOT NULL,
	`current_stage_kind` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`student_id`, `content_item_id`),
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_progress_v2_next_due_idx` ON `item_progress_v2` (`student_id`,`next_due_at`);
--> statement-breakpoint
CREATE INDEX `item_progress_v2_student_track_idx` ON `item_progress_v2` (`student_id`,`track`);
--> statement-breakpoint
INSERT OR IGNORE INTO `app_settings` (`key`, `value`) VALUES ('srs_archive_acknowledged', 'false');
--> statement-breakpoint
INSERT OR IGNORE INTO `app_settings` (`key`, `value`) VALUES ('fsrs_short_term_days', '1');
--> statement-breakpoint
INSERT OR IGNORE INTO `app_settings` (`key`, `value`) VALUES ('fsrs_long_term_days', '21');
