-- v0.10 → pre-v0.10 personal-dict FSRS rollback playbook. NOT applied
-- automatically. Run by hand if you need to revert v0.10's personal-dict
-- scheduler change. Entry metadata is preserved; per-item FSRS state is
-- destroyed and the legacy cycle counters return as zeroed columns.
--
-- Usage:
--   sqlite3 ~/Library/Application\ Support/lexicon-lab/vocab.dev.db \
--     < drizzle/0005_personal_dict_fsrs.rollback.sql
DROP INDEX IF EXISTS `dictionary_learning_items_student_due_idx`;
ALTER TABLE `dictionary_learning_items` DROP COLUMN `stability`;
ALTER TABLE `dictionary_learning_items` DROP COLUMN `difficulty`;
ALTER TABLE `dictionary_learning_items` DROP COLUMN `state`;
ALTER TABLE `dictionary_learning_items` DROP COLUMN `reps`;
ALTER TABLE `dictionary_learning_items` DROP COLUMN `lapses`;
ALTER TABLE `dictionary_learning_items` ADD COLUMN `correct_in_cycle` integer DEFAULT 0 NOT NULL;
ALTER TABLE `dictionary_learning_items` ADD COLUMN `short_term_correct` integer DEFAULT 0 NOT NULL;
ALTER TABLE `dictionary_learning_items` ADD COLUMN `score` integer DEFAULT 0 NOT NULL;
CREATE INDEX `dictionary_learning_items_student_due_idx` ON `dictionary_learning_items` (`student_id`,`status`,`next_due_at`);
