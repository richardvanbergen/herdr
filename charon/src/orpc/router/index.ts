import { os } from '@orpc/server'
import {
  listBoards,
  getBoard,
  createBoard,
  createColumn,
  createCard,
  updateCard,
  updateColumn,
  deleteCard,
  deleteColumn
} from '#/board/server/orpc'

const router = os.router({
  listBoards,
  getBoard,
  createBoard,
  createColumn,
  createCard,
  updateCard,
  updateColumn,
  deleteCard,
  deleteColumn
})

export default router
