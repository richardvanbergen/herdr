import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

export const todos = sqliteTable('todos', {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  createdAt: text('created_at').default(new Date().toISOString()),
})
