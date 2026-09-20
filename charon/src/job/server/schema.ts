import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Job content only. Board placement and ordering belong to the board domain.
 */
export const jobs = sqliteTable("jobs", {
	id: integer().primaryKey({ autoIncrement: true }),
	title: text().notNull(),
	description: text(),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
