import { Column } from './Column'
import type { Board } from '#/store/boardStore'

export interface BoardProps {
  board: Board
}

export function Board({ board }: BoardProps) {
  return (
    <div className="kanban-board">
      <div className="board-header">
        <h1 className="board-title">{board.name}</h1>
      </div>
      <div className="board-columns">
        {board.columns.map((column) => (
          <Column key={column.id} name={column.name} cards={column.cards} />
        ))}
      </div>
    </div>
  )
}
