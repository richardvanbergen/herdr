import * as React from 'react'
import { cn } from '#/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card" className={cn(
    'flex flex-col border border-border bg-card/80 text-foreground transition-colors hover:border-primary/30 hover:bg-white/[.03]',
    className,
  )} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-4', className)} {...props} />
}

export { Card, CardContent }
