ALTER TABLE `task_runs` ADD `prompt` text;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `activity` text DEFAULT '[]' NOT NULL;