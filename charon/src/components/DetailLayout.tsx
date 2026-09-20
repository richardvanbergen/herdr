import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '#/lib/utils'

interface DetailLayoutProps {
  title: string
  closeTo: '/' | '/column/$columnId' | '/column/$columnId/job/$jobId'
  closeParams?: Record<string, string>
  closeLabel: string
  nested?: boolean
  actions?: ReactNode
  children: ReactNode
}

export function DetailLayout({ title, closeTo, closeParams, closeLabel, nested = false, actions, children }: DetailLayoutProps) {
  return <section className={cn(
    'flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#090d1d]',
    nested ? 'relative h-full' : 'relative h-dvh flex-1',
  )}>
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#1b2745] bg-[#121a30] px-5">
      <h1 className="m-0 truncate text-base font-semibold">{title}</h1>
      <div className="flex shrink-0 items-center gap-4">
        {actions}
        <Link to={closeTo} params={closeParams} aria-label={closeLabel} className="text-2xl leading-none text-[#e8eaf6] hover:text-[#00d4ff]">×</Link>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
  </section>
}
