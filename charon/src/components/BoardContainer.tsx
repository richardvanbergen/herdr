import { useStore } from '@tanstack/react-store'

import { Board } from '#/components/ui/Board'
import { boardStore } from '#/store/boardStore'

import type { Card, Column } from '#/store/boardStore'

function withNormalisedPositions(cards: Card[]) {
  return cards.map((card, index) => ({ ...card, position: index + 1 }))
}

function moveCard(
  columns: Column[],
  cardId: number,
  destinationColumnId: number,
  destinationIndex: number,
) {
  const sourceColumn = columns.find((column) =>
    column.cards.some((card) => card.id === cardId),
  )
  const destinationColumn = columns.find(
    (column) => column.id === destinationColumnId,
  )
  const card = sourceColumn?.cards.find((candidate) => candidate.id === cardId)

  if (!sourceColumn || !destinationColumn || !card) return columns

  const sourceCards = sourceColumn.cards.filter((candidate) => candidate.id !== cardId)
  const targetCards =
    sourceColumn.id === destinationColumn.id ? sourceCards : destinationColumn.cards
  const insertionIndex = Math.max(0, Math.min(destinationIndex, targetCards.length))
  const destinationCards = [...targetCards]
  destinationCards.splice(insertionIndex, 0, {
    ...card,
    columnId: destinationColumnId,
  })

  return columns.map((column) => {
    if (column.id === sourceColumn.id && column.id === destinationColumn.id) {
      return { ...column, cards: withNormalisedPositions(destinationCards) }
    }
    if (column.id === sourceColumn.id) {
      return { ...column, cards: withNormalisedPositions(sourceCards) }
    }
    if (column.id === destinationColumn.id) {
      return { ...column, cards: withNormalisedPositions(destinationCards) }
    }
    return column
  })
}

export function BoardContainer() {
  const { currentBoard, error, isLoading } = useStore(boardStore)

  function handleMoveCard(
    cardId: number,
    destinationColumnId: number,
    destinationIndex: number,
  ) {
    boardStore.setState((previous) => {
      if (!previous.currentBoard) return previous

      return {
        ...previous,
        currentBoard: {
          ...previous.currentBoard,
          columns: moveCard(
            previous.currentBoard.columns,
            cardId,
            destinationColumnId,
            destinationIndex,
          ),
        },
      }
    })
  }

  if (isLoading) {
    return <div className="board-loading">Loading board...</div>
  }

  if (error) {
    return <div className="board-error">Error: {error}</div>
  }

  if (!currentBoard) {
    return <div className="board-empty">No board selected</div>
  }

  return <Board board={currentBoard} onMoveCard={handleMoveCard} />
}
