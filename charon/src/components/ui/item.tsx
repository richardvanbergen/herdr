import * as React from 'react'
import { cn } from '#/lib/utils'

function Item({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="item" className={cn(
    'flex min-w-0 items-center gap-3 border border-border bg-card/80 p-4 text-foreground transition-colors hover:border-primary/30 hover:bg-white/[.03]',
    className,
  )} {...props} />
}

function ItemContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="item-content" className={cn('flex min-w-0 flex-1 flex-col gap-1', className)} {...props} />
}

export { Item, ItemContent }
