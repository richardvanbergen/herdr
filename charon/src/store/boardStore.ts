import { Store } from '@tanstack/react-store'

export interface Card {
  id: number
  columnId: number
  title: string
  description?: string | null
  position: number
  createdAt: string
}

export interface Column {
  id: number
  boardId: number
  name: string
  position: number
  cards: Card[]
}

export interface Board {
  id: number
  name: string
  columns: Column[]
}

export const boardStore = new Store<{
  currentBoard: Board | null
  isLoading: boolean
  error: string | null
}>({
  currentBoard: null,
  isLoading: false,
  error: null,
})
