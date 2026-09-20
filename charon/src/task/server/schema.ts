import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { jobs } from "#/job/server/schema";

export const tasks = sqliteTable("tasks", {
	id: integer().primaryKey({ autoIncrement: true }),
	jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
	text: text().notNull(),
	output: text(),
	position: integer().notNull(),
});

export type Task = typeof tasks.$inferSelect;
