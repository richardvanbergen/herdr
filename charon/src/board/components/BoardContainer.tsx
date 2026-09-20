import { useStore } from '@tanstack/react-store'

import { boardStore } from '#/board/board-store'

import { Board } from './Board'

import type { BoardColumn } from '#/board/board-store'

function moveCardId(
  columns: BoardColumn[],
  cardId: number,
  destinationColumnId: number,
  destinationIndex: number,
) {
  const sourceColumn = columns.find((column) => column.cardIds.includes(cardId))
  const destinationColumn = columns.find(
    (column) => column.id === destinationColumnId,
  )

  if (!sourceColumn || !destinationColumn) return columns

  const sourceCardIds = sourceColumn.cardIds.filter((id) => id !== cardId)
  const targetCardIds =
    sourceColumn.id === destinationColumn.id
      ? sourceCardIds
      : destinationColumn.cardIds
  const insertionIndex = Math.max(0, Math.min(destinationIndex, targetCardIds.length))
  const destinationCardIds = [...targetCardIds]
  destinationCardIds.splice(insertionIndex, 0, cardId)

  return columns.map((column) => {
    if (column.id === sourceColumn.id && column.id === destinationColumn.id) {
      return { ...column, cardIds: destinationCardIds }
    }
    if (column.id === sourceColumn.id) {
      return { ...column, cardIds: sourceCardIds }
    }
    if (column.id === destinationColumn.id) {
      return { ...column, cardIds: destinationCardIds }
    }
    return column
  })
}

export function BoardContainer() {
  const board = useStore(boardStore)

  function handleMoveCard(
    cardId: number,
    destinationColumnId: number,
    destinationIndex: number,
  ) {
    boardStore.setState((previous) => ({
      ...previous,
      columns: moveCardId(
        previous.columns,
        cardId,
        destinationColumnId,
        destinationIndex,
      ),
    }))
  }

  return <Board board={board} onMoveCard={handleMoveCard} />
}
