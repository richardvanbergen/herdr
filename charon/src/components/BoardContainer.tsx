import { useStore } from '@tanstack/react-store'
import { boardStore } from '#/store/boardStore'
import { Board } from '#/components/ui/Board'

export function BoardContainer() {
  const { currentBoard, isLoading, error } = useStore(boardStore)

  function handleMoveCard(cardId: number, toColumnId: number, toPosition: number) {
    boardStore.setState((prev) => {
      if (!prev.currentBoard) return prev

      const board = prev.currentBoard
      let draggedCard: any = null

      // Find and remove the card from its current column
      const updatedColumns = board.columns.map((col) => {
        const card = col.cards.find((c) => c.id === cardId)
        if (card) {
          draggedCard = card
          return {
            ...col,
            cards: col.cards.filter((c) => c.id !== cardId),
          }
        }
        return col
      })

      if (!draggedCard) return prev

      // Add the card to the target column
      const finalColumns = updatedColumns.map((col) => {
        if (col.id === toColumnId) {
          const updatedCard = { ...draggedCard, columnId: toColumnId, position: toPosition }
          const newCards = [...col.cards, updatedCard].sort((a, b) => a.position - b.position)
          return { ...col, cards: newCards }
        }
        return col
      })

      return {
        ...prev,
        currentBoard: {
          ...board,
          columns: finalColumns,
        },
      }
    })
  }

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

  return <Board board={currentBoard} onMoveCard={handleMoveCard} />
}
