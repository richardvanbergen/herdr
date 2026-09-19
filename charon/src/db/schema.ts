import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const boards = sqliteTable('boards', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
})

export const columns = sqliteTable('columns', {
  id: integer().primaryKey({ autoIncrement: true }),
  boardId: integer('board_id').notNull(),
  name: text().notNull(),
  position: integer().notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
})

export const cards = sqliteTable('cards', {
  id: integer().primaryKey({ autoIncrement: true }),
  columnId: integer('column_id').notNull(),
  title: text().notNull(),
  description: text(),
  position: integer().notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
})
