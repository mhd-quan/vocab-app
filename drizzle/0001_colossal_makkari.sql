CREATE TABLE `student_achievements` (
	`student_id` integer NOT NULL,
	`achievement_id` text NOT NULL,
	`unlocked_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`student_id`, `achievement_id`),
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `student_achievements_student_idx` ON `student_achievements` (`student_id`,`unlocked_at`);