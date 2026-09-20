ALTER TABLE `card_placements` RENAME TO `job_placements`;--> statement-breakpoint
ALTER TABLE `cards` RENAME TO `jobs`;--> statement-breakpoint
ALTER TABLE `job_placements` RENAME COLUMN "card_id" TO "job_id";--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`text` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_job_placements` (
	`job_id` integer PRIMARY KEY NOT NULL,
	`column_id` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`column_id`) REFERENCES `columns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_job_placements`("job_id", "column_id", "position") SELECT "job_id", "column_id", "position" FROM `job_placements`;--> statement-breakpoint
DROP TABLE `job_placements`;--> statement-breakpoint
ALTER TABLE `__new_job_placements` RENAME TO `job_placements`;--> statement-breakpoint
PRAGMA foreign_keys=ON;