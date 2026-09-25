import type { ComponentProps } from 'react'
import { ChevronDownIcon, WrenchIcon } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible'
import { cn } from '#/lib/utils'

// Adapted from AI Elements' Tool component for Charon's shared agent events.
export function Tool({ className, ...props }: ComponentProps<typeof Collapsible>) {
  return <Collapsible className={cn('group border border-border', className)} {...props} />
}

export function ToolHeader({ name, status }: { name: string; status: 'running' | 'completed' | 'failed' }) {
  return <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm text-foreground">
    <span className="flex min-w-0 items-center gap-2"><WrenchIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{name}</span>
      <Badge variant="outline" className={cn('rounded-none', status === 'failed' ? 'text-destructive' : 'text-primary')}>{status}</Badge>
    </span>
    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
}

export function ToolContent({ className, ...props }: ComponentProps<typeof CollapsibleContent>) {
  return <CollapsibleContent className={cn('border-t border-border p-3 text-xs whitespace-pre-wrap text-muted-foreground', className)} {...props} />
}
