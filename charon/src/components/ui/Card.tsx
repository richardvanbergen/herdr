export interface CardProps {
  title: string
  description?: string | null
  createdAt: string
  position: number
}

export function Card({ title, description, createdAt, position }: CardProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="kanban-card">
      <div className="card-header">
        <span className="card-position">{position}</span>
        <span className="card-date">{formattedDate}</span>
      </div>
      <h3 className="card-title">{title}</h3>
      {description && (
        <div className="card-preview">
          {description.substring(0, 80)}
          {description.length > 80 && '...'}
        </div>
      )}
    </div>
  )
}
