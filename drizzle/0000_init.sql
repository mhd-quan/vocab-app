CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`level` text,
	`publisher` text,
	`language` text DEFAULT 'en' NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_code_unique` ON `books` (`code`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`unit_id` integer NOT NULL,
	`ordinal` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_unit_slug_unique` ON `lessons` (`unit_id`,`slug`);--> statement-breakpoint
CREATE INDEX `lessons_unit_ordinal_idx` ON `lessons` (`unit_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`ordinal` integer NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`summary_md` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_book_ordinal_unique` ON `units` (`book_id`,`ordinal`);--> statement-breakpoint
CREATE UNIQUE INDEX `units_book_code_unique` ON `units` (`book_id`,`code`);--> statement-breakpoint
CREATE TABLE `vocab_collocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`collocation` text NOT NULL,
	`pattern` text,
	`example_text` text,
	`notes_md` text,
	FOREIGN KEY (`entry_id`) REFERENCES `vocab_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vocab_collocations_entry_idx` ON `vocab_collocations` (`entry_id`);--> statement-breakpoint
CREATE TABLE `vocab_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_id` integer NOT NULL,
	`source_id` text,
	`headword` text NOT NULL,
	`lemma` text,
	`pos` text NOT NULL,
	`ipa` text,
	`cefr_level` text,
	`frequency_rank` integer,
	`image_ref` text,
	`audio_ref` text,
	`tags` text,
	`metadata` text,
	`content_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_entries_lesson_source_unique` ON `vocab_entries` (`lesson_id`,`source_id`) WHERE "vocab_entries"."source_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `vocab_entries_headword_idx` ON `vocab_entries` (`headword`);--> statement-breakpoint
CREATE INDEX `vocab_entries_lesson_headword_idx` ON `vocab_entries` (`lesson_id`,`headword`);--> statement-breakpoint
CREATE TABLE `vocab_examples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`sense_id` integer,
	`ordinal` integer DEFAULT 0 NOT NULL,
	`text` text NOT NULL,
	`translation` text,
	`cloze_target` text,
	`cloze_hint` text,
	`audio_ref` text,
	`source_ref` text,
	FOREIGN KEY (`entry_id`) REFERENCES `vocab_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sense_id`) REFERENCES `vocab_senses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `vocab_examples_entry_ordinal_idx` ON `vocab_examples` (`entry_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `vocab_forms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`kind` text NOT NULL,
	`form_text` text NOT NULL,
	`ipa` text,
	FOREIGN KEY (`entry_id`) REFERENCES `vocab_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vocab_forms_entry_kind_idx` ON `vocab_forms` (`entry_id`,`kind`);--> statement-breakpoint
CREATE TABLE `vocab_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`related_entry_id` integer,
	`related_text` text,
	`relation` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `vocab_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_entry_id`) REFERENCES `vocab_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `vocab_relations_entry_relation_idx` ON `vocab_relations` (`entry_id`,`relation`);--> statement-breakpoint
CREATE TABLE `vocab_senses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`ordinal` integer DEFAULT 0 NOT NULL,
	`definition_en` text,
	`definition_vi` text,
	`register` text,
	`domain` text,
	`notes_md` text,
	FOREIGN KEY (`entry_id`) REFERENCES `vocab_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vocab_senses_entry_ordinal_idx` ON `vocab_senses` (`entry_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `grammar_topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_id` integer NOT NULL,
	`source_id` text,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary_md` text,
	`explanation_md` text,
	`difficulty` integer,
	`tags` text,
	`metadata` text,
	`content_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_topics_lesson_slug_unique` ON `grammar_topics` (`lesson_id`,`slug`);--> statement-breakpoint
CREATE INDEX `grammar_topics_title_idx` ON `grammar_topics` (`title`);--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`ref_table` text NOT NULL,
	`ref_id` integer NOT NULL,
	`lesson_id` integer NOT NULL,
	`tags` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_items_ref_unique` ON `content_items` (`ref_table`,`ref_id`);--> statement-breakpoint
CREATE INDEX `content_items_lesson_kind_idx` ON `content_items` (`lesson_id`,`kind`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`current_unit_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`current_unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_student_book_unique` ON `enrollments` (`student_id`,`book_id`);--> statement-breakpoint
CREATE INDEX `enrollments_student_status_idx` ON `enrollments` (`student_id`,`status`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`avatar_seed` text,
	`color` text,
	`pin_hash` text,
	`notes` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `students_name_idx` ON `students` (`name`);--> statement-breakpoint
CREATE TABLE `item_progress` (
	`student_id` integer NOT NULL,
	`content_item_id` integer NOT NULL,
	`last_seen_at` integer,
	`next_due_at` integer,
	`ease` integer,
	`interval_days` integer,
	`streak` integer DEFAULT 0 NOT NULL,
	`total_correct` integer DEFAULT 0 NOT NULL,
	`total_wrong` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`student_id`, `content_item_id`),
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_progress_next_due_idx` ON `item_progress` (`student_id`,`next_due_at`);--> statement-breakpoint
CREATE TABLE `learning_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`content_item_id` integer NOT NULL,
	`session_id` integer,
	`kind` text NOT NULL,
	`payload` text,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `learning_events_student_item_idx` ON `learning_events` (`student_id`,`content_item_id`);--> statement-breakpoint
CREATE INDEX `learning_events_occurred_at_idx` ON `learning_events` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`mode` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ended_at` integer,
	`summary` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `practice_sessions_student_started_idx` ON `practice_sessions` (`student_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `import_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`source_id` text,
	`target_table` text NOT NULL,
	`target_id` integer,
	`action` text NOT NULL,
	`hash` text,
	`error` text,
	FOREIGN KEY (`run_id`) REFERENCES `import_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `import_items_run_idx` ON `import_items` (`run_id`);--> statement-breakpoint
CREATE INDEX `import_items_target_idx` ON `import_items` (`target_table`,`target_id`);--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_path` text NOT NULL,
	`content_hash` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finished_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`stats` text,
	`error_log` text
);
--> statement-breakpoint
CREATE INDEX `import_runs_source_started_idx` ON `import_runs` (`source_path`,`started_at`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
