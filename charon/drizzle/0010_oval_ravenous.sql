CREATE TABLE `job_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`task_id` integer,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`request_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_messages_request_id_unique` ON `job_messages` (`request_id`);--> statement-breakpoint
CREATE TABLE `job_workflow` (
	`job_id` integer PRIMARY KEY NOT NULL,
	`ready` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`done_when` text DEFAULT '' NOT NULL,
	`runner` text DEFAULT 'codex' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`claim_revision` integer,
	`token` text,
	`lease_until` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workflow_dispatches` (
	`request_id` text PRIMARY KEY NOT NULL,
	`job_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`run_id` integer,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `assignee` text DEFAULT 'agent' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `state` text DEFAULT 'todo' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `request_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_request_id_unique` ON `tasks` (`request_id`);