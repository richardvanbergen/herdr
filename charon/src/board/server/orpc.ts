import { os } from '@orpc/server'
import * as z from 'zod'
import { db } from '#/db'
import { boards, columns, cards } from '#/db/schema'
import { eq } from 'drizzle-orm'

export const listBoards = os.handler(() => {
  return db.select().from(boards).all()
})

export const getBoard = os
  .input(z.object({ boardId: z.number() }))
  .handler(({ input }) => {
    const board = db.select().from(boards).where(eq(boards.id, input.boardId)).get()
    const boardColumns = db
      .select()
      .from(columns)
      .where(eq(columns.boardId, input.boardId))
      .orderBy(columns.position)
      .all()

    const boardCards = boardColumns.flatMap(col =>
      db
        .select()
        .from(cards)
        .where(eq(cards.columnId, col.id))
        .orderBy(cards.position)
        .all()
    )

    return { board, columns: boardColumns, cards: boardCards }
  })

export const createBoard = os
  .input(z.object({ name: z.string() }))
  .handler(({ input }) => {
    return db.insert(boards).values({ name: input.name }).returning().get()
  })

export const createColumn = os
  .input(z.object({ boardId: z.number(), name: z.string(), position: z.number() }))
  .handler(({ input }) => {
    return db.insert(columns).values(input).returning().get()
  })

export const createCard = os
  .input(z.object({
    columnId: z.number(),
    title: z.string(),
    description: z.string().optional(),
    position: z.number()
  }))
  .handler(({ input }) => {
    return db.insert(cards).values(input).returning().get()
  })

export const updateCard = os
  .input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    columnId: z.number().optional(),
    position: z.number().optional()
  }))
  .handler(({ input }) => {
    const { id, ...data } = input
    return db.update(cards).set(data).where(eq(cards.id, id)).returning().get()
  })

export const updateColumn = os
  .input(z.object({
    id: z.number(),
    name: z.string().optional(),
    position: z.number().optional()
  }))
  .handler(({ input }) => {
    const { id, ...data } = input
    return db.update(columns).set(data).where(eq(columns.id, id)).returning().get()
  })

export const deleteCard = os
  .input(z.object({ id: z.number() }))
  .handler(({ input }) => {
    db.delete(cards).where(eq(cards.id, input.id))
    return { success: true }
  })

export const deleteColumn = os
  .input(z.object({ id: z.number() }))
  .handler(({ input }) => {
    db.delete(cards).where(eq(cards.columnId, input.id))
    db.delete(columns).where(eq(columns.id, input.id))
    return { success: true }
  })
