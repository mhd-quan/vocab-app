-- v0.10 personal-dictionary FSRS migration.
--
-- Entry metadata (headword, defs, audio_ref, dictionary_key) is preserved
-- in place — students keep the personal collection they built. Per-item
-- scheduling state is fresh-start: FSRS-lite columns are added and the
-- legacy cycle counters (correct_in_cycle / short_term_correct / score)
-- are dropped. Tallies + timestamps reset so the new scheduler starts
-- from a known baseline.
--
-- Reviews log (`dictionary_learning_reviews`) is left untouched — it's
-- the append-only history equivalent of `learning_events` for the
-- personal track.
DROP INDEX IF EXISTS `dictionary_learning_items_student_due_idx`;
--> statement-breakpoint
ALTER TABLE `dictionary_learning_items` ADD COLUMN `stability` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `dictionary_learning_items` ADD COLUMN `difficulty` real DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE `dictionary_learning_items` ADD COLUMN `state` text DEFAULT 'new' NOT NULL;
--> statement-breakpoint
ALTER TABLE `dictionary_learning_items` ADD COLUMN `reps` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `dictionary_learning_items` ADD COLUMN `lapses` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `dictionary_learning_items` DROP COLUMN `correct_in_cycle`;
--> statement-breakpoint
ALTER TABLE `dictionary_learning_items` DROP COLUMN `short_term_correct`;
--> statement-breakpoint
ALTER TABLE `dictionary_learning_items` DROP COLUMN `score`;
--> statement-breakpoint
UPDATE `dictionary_learning_items` SET
  `status` = 'learning',
  `stage` = 'flashcard',
  `total_correct` = 0,
  `total_wrong` = 0,
  `last_reviewed_at` = NULL,
  `next_due_at` = NULL,
  `updated_at` = (unixepoch() * 1000);
--> statement-breakpoint
CREATE INDEX `dictionary_learning_items_student_due_idx` ON `dictionary_learning_items` (`student_id`,`status`,`next_due_at`);
