CREATE TABLE `task_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`runner` text NOT NULL,
	`status` text NOT NULL,
	`output` text DEFAULT '' NOT NULL,
	`error` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `latest_run_id` integer;