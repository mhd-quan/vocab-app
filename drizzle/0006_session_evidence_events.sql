CREATE TABLE `session_evidence_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`session_id` integer NOT NULL,
	`kind` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`duration_ms` integer,
	`payload` text,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_evidence_events_session_idx` ON `session_evidence_events` (`session_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `session_evidence_events_student_occurred_idx` ON `session_evidence_events` (`student_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `session_evidence_events_kind_idx` ON `session_evidence_events` (`kind`);
