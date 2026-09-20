import * as React from 'react'
import { cn } from '#/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card" className={cn(
    'flex flex-col border border-[#1b2745] bg-[#0b1022]/80 text-[#e8eaf6] transition-colors hover:border-[#00d4ff] hover:bg-[#121a30]/90',
    className,
  )} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-4', className)} {...props} />
}

export { Card, CardContent }
