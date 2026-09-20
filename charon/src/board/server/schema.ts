import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { jobs } from "#/job/server/schema";

/** Columns form the current single board; a board ID can be added here later. */
export const columns = sqliteTable("columns", {
	id: integer().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	position: integer().notNull(),
});

/** One placement per job, with ordering local to its column. */
export const jobPlacements = sqliteTable("job_placements", {
	jobId: integer("job_id").primaryKey().references(() => jobs.id, { onDelete: "cascade" }),
	columnId: integer("column_id").notNull().references(() => columns.id, { onDelete: "cascade" }),
	position: integer().notNull(),
});
