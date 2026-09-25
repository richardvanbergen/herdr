import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { tasks } from '#/task/server/schema'
import { runnerIds } from '#/agent/runner-options'

export const conversationThreads = sqliteTable('conversation_threads', {
  id: integer().primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  runner: text({ enum: runnerIds }).notNull().default('codex'),
  createdAt: integer('created_at').notNull(),
})

export const conversationMessages = sqliteTable('conversation_messages', {
  id: integer().primaryKey({ autoIncrement: true }),
  threadId: integer('thread_id').notNull().references(() => conversationThreads.id, { onDelete: 'cascade' }),
  role: text({ enum: ['human', 'agent'] }).notNull(),
  content: text().notNull(),
  createdAt: integer('created_at').notNull(),
})

export type ConversationThread = typeof conversationThreads.$inferSelect
export type ConversationMessage = typeof conversationMessages.$inferSelect
