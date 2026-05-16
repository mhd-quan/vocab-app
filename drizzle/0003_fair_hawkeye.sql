CREATE TABLE `dictionary_learning_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`dictionary_key` text NOT NULL,
	`headword` text NOT NULL,
	`pos` text NOT NULL,
	`ipa` text,
	`cefr_level` text,
	`definition_en` text NOT NULL,
	`definition_vi` text,
	`example_text` text,
	`example_translation` text,
	`audio_ref` text,
	`status` text DEFAULT 'learning' NOT NULL,
	`stage` text DEFAULT 'flashcard' NOT NULL,
	`correct_in_cycle` integer DEFAULT 0 NOT NULL,
	`short_term_correct` integer DEFAULT 0 NOT NULL,
	`total_correct` integer DEFAULT 0 NOT NULL,
	`total_wrong` integer DEFAULT 0 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`last_reviewed_at` integer,
	`next_due_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dictionary_learning_items_student_key_unique` ON `dictionary_learning_items` (`student_id`,`dictionary_key`);--> statement-breakpoint
CREATE INDEX `dictionary_learning_items_student_due_idx` ON `dictionary_learning_items` (`student_id`,`status`,`next_due_at`);--> statement-breakpoint
CREATE TABLE `dictionary_learning_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`session_id` integer,
	`stage_before` text NOT NULL,
	`stage_after` text NOT NULL,
	`status_after` text NOT NULL,
	`correct` integer NOT NULL,
	`answer` text,
	`expected` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `dictionary_learning_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `dictionary_learning_reviews_item_created_idx` ON `dictionary_learning_reviews` (`item_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `dictionary_learning_reviews_student_created_idx` ON `dictionary_learning_reviews` (`student_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dictionary_search_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`query` text NOT NULL,
	`dictionary_key` text,
	`headword` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dictionary_search_events_student_created_idx` ON `dictionary_search_events` (`student_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `dictionary_search_events_student_query_idx` ON `dictionary_search_events` (`student_id`,`query`);