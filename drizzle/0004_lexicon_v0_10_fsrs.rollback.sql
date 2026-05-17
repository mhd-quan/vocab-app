-- v0.10 → pre-v0.10 rollback playbook. NOT applied automatically.
-- Run by hand against the SQLite file if v0.10 needs to revert and resume
-- SM-2 behaviour. FSRS-lite state is destroyed; student progress resumes
-- from the archived SM-2 snapshot.
--
-- Usage:
--   sqlite3 ~/Library/Application\ Support/lexicon-lab/vocab.dev.db \
--     < drizzle/0004_lexicon_v0_10_fsrs.rollback.sql
--
-- Then revert `electron/db/repositories/progress.ts` and the schema files
-- to the pre-v0.10 commit before relaunching.
DROP INDEX IF EXISTS `item_progress_v2_next_due_idx`;
DROP INDEX IF EXISTS `item_progress_v2_student_track_idx`;
DROP TABLE IF EXISTS `item_progress_v2`;
ALTER TABLE `item_progress_v1_archive` RENAME TO `item_progress`;
CREATE INDEX `item_progress_next_due_idx` ON `item_progress` (`student_id`,`next_due_at`);
DELETE FROM `app_settings` WHERE `key` IN (
  'srs_archive_acknowledged',
  'fsrs_short_term_days',
  'fsrs_long_term_days'
);
