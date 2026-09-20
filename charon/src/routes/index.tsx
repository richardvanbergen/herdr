import { createFileRoute } from '@tanstack/react-router'

import { BoardContainer } from '#/components/BoardContainer'
import { boardStore } from '#/store/boardStore'

export const Route = createFileRoute('/')({
  component: BoardPage,
})

// Temporary front-end board setup. It deliberately contains only card IDs.
boardStore.setState(() => ({
  columns: [
    { id: 1, name: 'Backlog', position: 1, cardIds: [1, 2, 3] },
    { id: 2, name: 'To Do', position: 2, cardIds: [4, 5] },
    { id: 3, name: 'In Progress', position: 3, cardIds: [6] },
    { id: 4, name: 'Done', position: 4, cardIds: [7, 8, 9] },
  ],
}))

function BoardPage() {
  return <BoardContainer />
}
