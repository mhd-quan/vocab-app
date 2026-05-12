CREATE TABLE `unit_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`status` text DEFAULT 'assigned' NOT NULL,
	`assigned_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	`metadata` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unit_assignments_student_unit_unique` ON `unit_assignments` (`student_id`,`unit_id`);--> statement-breakpoint
CREATE INDEX `unit_assignments_student_status_idx` ON `unit_assignments` (`student_id`,`status`);--> statement-breakpoint
CREATE INDEX `unit_assignments_unit_idx` ON `unit_assignments` (`unit_id`);