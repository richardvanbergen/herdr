import { Card } from './Card'
import type { Card as CardType } from '#/store/boardStore'

export interface ColumnProps {
  name: string
  cards: CardType[]
}

export function Column({ name, cards }: ColumnProps) {
  return (
    <div className="kanban-column">
      <div className="column-header">
        <h2 className="column-title">{name}</h2>
        <span className="column-count">{cards.length}</span>
      </div>
      <div className="column-content">
        {cards.map((card) => (
          <Card
            key={card.id}
            title={card.title}
            description={card.description}
            createdAt={card.createdAt}
            position={card.position}
          />
        ))}
      </div>
    </div>
  )
}
