import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Card content only. Board placement and ordering belong to the board domain.
 */
export const cards = sqliteTable("cards", {
	id: integer().primaryKey({ autoIncrement: true }),
	title: text().notNull(),
	description: text(),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
