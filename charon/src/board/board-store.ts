import { Store } from '@tanstack/react-store'

export interface BoardColumn {
  id: number
  name: string
  position: number
  cardIds: number[]
}

export interface BoardView {
  columns: BoardColumn[]
}

/**
 * Interaction state only: board setup plus ordered card identifiers.
 * Card content is resolved independently by each card through TanStack Query.
 */
export const boardStore = new Store<BoardView>({
  columns: [],
})
