export interface BoardColumn {
  id: number
  name: string
  position: number
  jobIds: number[]
}

export interface BoardView {
  columns: BoardColumn[]
}
