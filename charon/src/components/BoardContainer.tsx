import { useStore } from '@tanstack/react-store'
import { boardStore } from '#/store/boardStore'
import { Board } from '#/components/ui/Board'

export function BoardContainer() {
  const { currentBoard, isLoading, error } = useStore(boardStore)

  if (isLoading) {
    return (
      <div className="board-loading">
        <p>Loading board...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="board-error">
        <p>Error: {error}</p>
      </div>
    )
  }

  if (!currentBoard) {
    return (
      <div className="board-empty">
        <p>No board selected</p>
      </div>
    )
  }

  return <Board board={currentBoard} />
}
