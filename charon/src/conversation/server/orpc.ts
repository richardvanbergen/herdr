import { ORPCError, os } from '@orpc/server'
import { asc, eq } from 'drizzle-orm'
import * as z from 'zod'
import { db } from '#/db'
import { tasks } from '#/task/server/schema'
import { conversationMessages, conversationThreads } from './schema'
import { runnerIds } from '#/agent/runner-options'

const id = z.number().int().positive()

export const conversationRouter = {
  listThreads: os.input(z.object({ taskId: id })).handler(({ input }) =>
    db.select().from(conversationThreads).where(eq(conversationThreads.taskId, input.taskId))
      .orderBy(asc(conversationThreads.createdAt), asc(conversationThreads.id)).all()),
  createThread: os.input(z.object({ taskId: id, title: z.string().trim().min(1).max(120).default('New conversation') }))
    .handler(({ input }) => {
      if (!db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, input.taskId)).get()) throw new ORPCError('NOT_FOUND')
      return db.insert(conversationThreads).values({ taskId: input.taskId, title: input.title, createdAt: Date.now() }).returning().get()
    }),
  updateThread: os.input(z.object({ id, runner: z.enum(runnerIds) })).handler(({ input }) => {
    const thread = db.update(conversationThreads).set({ runner: input.runner })
      .where(eq(conversationThreads.id, input.id)).returning().get()
    if (!thread) throw new ORPCError('NOT_FOUND')
    return thread
  }),
  listMessages: os.input(z.object({ threadId: id })).handler(({ input }) => {
    if (!db.select({ id: conversationThreads.id }).from(conversationThreads).where(eq(conversationThreads.id, input.threadId)).get()) throw new ORPCError('NOT_FOUND')
    return db.select().from(conversationMessages).where(eq(conversationMessages.threadId, input.threadId))
      .orderBy(asc(conversationMessages.id)).all()
  }),
}
