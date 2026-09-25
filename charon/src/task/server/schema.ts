import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { jobs } from "#/job/server/schema";
import type { RunActivity } from '../run-types';

export const tasks = sqliteTable("tasks", {
	id: integer().primaryKey({ autoIncrement: true }),
	jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
	text: text().notNull(),
	output: text(),
	latestRunId: integer("latest_run_id"),
	position: integer().notNull(),
	useJobContext: integer("use_job_context", { mode: "boolean" }).notNull().default(true),
});

export type Task = typeof tasks.$inferSelect;

export const taskRuns = sqliteTable("task_runs", {
	id: integer().primaryKey({ autoIncrement: true }),
	taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
	runner: text().notNull(),
	prompt: text(),
	activity: text({ mode: "json" }).$type<RunActivity[]>().notNull().default([]),
	status: text().notNull(),
	output: text().notNull().default(''),
	error: text(),
	startedAt: integer("started_at").notNull(),
	endedAt: integer("ended_at"),
});

export type TaskRun = typeof taskRuns.$inferSelect;
