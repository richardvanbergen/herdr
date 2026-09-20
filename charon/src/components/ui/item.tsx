import * as React from 'react'
import { cn } from '#/lib/utils'

function Item({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="item" className={cn(
    'flex min-w-0 items-center gap-3 border border-[#1b2745] bg-[#0b1022]/80 p-4 text-[#e8eaf6] transition-colors hover:border-[#00d4ff] hover:bg-[#121a30]/90',
    className,
  )} {...props} />
}

function ItemContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="item-content" className={cn('flex min-w-0 flex-1 flex-col gap-1', className)} {...props} />
}

export { Item, ItemContent }
