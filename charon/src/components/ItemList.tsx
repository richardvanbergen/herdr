import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

export function ItemList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-col', className)}>{children}</div>
}
